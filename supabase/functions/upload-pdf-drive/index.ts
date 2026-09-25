import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ─── CORS Headers ────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Normaliza el drive_folder_id: acepta URL completa o solo el ID ──────────
function normalizeDriveFolderId(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  const queryMatch = trimmed.match(/^([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  return trimmed;
}

// ─── Generación de Access Token con OAuth2 Refresh Token (Cuenta de Usuario) ──
async function getAccessTokenFromRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Error canjeando Refresh Token de Google OAuth2: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ─── Extrae el ID del archivo de Google Drive desde una URL o ID directo ───
function extractDriveFileId(rawUrlOrId?: string | null): string | null {
  if (!rawUrlOrId || typeof rawUrlOrId !== "string") return null;
  const trimmed = rawUrlOrId.trim();
  const matchFile = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile) return matchFile[1];
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam) return matchIdParam[1];
  const matchDirect = trimmed.match(/^([a-zA-Z0-9_-]{20,})/);
  if (matchDirect) return matchDirect[1];
  return null;
}

// ─── Handler Principal ───────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido. Utiliza POST." }, 405);
  }

  try {
    // 1. Obtener Token de Acceso de Google Drive
    let accessToken = "";

    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!refreshToken || !clientId || !clientSecret) {
      return jsonResponse(
        {
          error:
            "Faltan los secrets de Google en Supabase. Configura 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID' y 'GOOGLE_CLIENT_SECRET' en Supabase Secrets.",
        },
        500,
      );
    }

    accessToken = await getAccessTokenFromRefreshToken(
      clientId,
      clientSecret,
      refreshToken,
    );

    const contentType = req.headers.get("content-type") || "";

    // ── ACCIÓN: ELIMINAR ARCHIVO DE GOOGLE DRIVE (JSON) ──────────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.action === "delete") {
        const fileId = extractDriveFileId(body.fileId || body.fileUrl);
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (fileId) {
          try {
            const delRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            );
            if (!delRes.ok && delRes.status !== 404) {
              const delErr = await delRes.text();
              console.warn("Aviso al eliminar de Google Drive:", delErr);
            }
          } catch (gErr) {
            console.warn("Error conectando con Google Drive para eliminar:", gErr);
          }
        }

        // Limpieza en base de datos
        if (body.resourceId) {
          await supabase.from("resources").delete().eq("id", body.resourceId);
        }
        if (body.classId && body.clearPresentation) {
          await supabase.from("class_sessions").update({ presentation_url: null }).eq("id", body.classId);
        }

        return jsonResponse({
          success: true,
          deletedFileId: fileId,
          message: "Archivo eliminado exitosamente de Google Drive.",
        });
      }
    }

    // ── ACCIÓN: SUBIDA DE ARCHIVO (FormData) ──────────────────────────────────
    const formData = await req.formData();

    // Si viene acción delete en FormData
    if (formData.get("action") === "delete") {
      const fileUrl = formData.get("fileUrl") as string | null;
      const fileIdParam = formData.get("fileId") as string | null;
      const resourceId = formData.get("resourceId") as string | null;
      const classId = formData.get("classId") as string | null;
      const clearPresentation = formData.get("clearPresentation") === "true";

      const fileId = extractDriveFileId(fileIdParam || fileUrl);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (fileId) {
        try {
          await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );
        } catch (delErr) {
          console.warn("Error al borrar en Google Drive:", delErr);
        }
      }

      if (resourceId) {
        await supabase.from("resources").delete().eq("id", resourceId);
      }
      if (classId && clearPresentation) {
        await supabase.from("class_sessions").update({ presentation_url: null }).eq("id", classId);
      }

      return jsonResponse({
        success: true,
        deletedFileId: fileId,
        message: "Archivo eliminado de Google Drive.",
      });
    }

    const file = formData.get("file") as File | null;
    const classId = formData.get("classId") as string | null;
    const programId = formData.get("programId") as string | null;
    const resourceType = (formData.get("resourceType") as string) || "presentation";
    const customTitle = formData.get("customTitle") as string | null;
    const allowDownloadRaw = formData.get("allowDownload") as string | null;
    const allowDownload = allowDownloadRaw === "true" || allowDownloadRaw === "1";

    const isGeneralCourseResource = !classId || classId === "general" || classId === "null";

    if (!file) {
      return jsonResponse({ error: "No se proporcionó ningún archivo." }, 400);
    }
    if (isGeneralCourseResource && !programId) {
      return jsonResponse({ error: "El parámetro 'programId' es requerido para subir material general del curso." }, 400);
    }
    if (!isGeneralCourseResource && !classId) {
      return jsonResponse({ error: "El parámetro 'classId' es requerido." }, 400);
    }

    // 3. Cliente Supabase con Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let targetFolderId: string | null = null;
    let formattedFileName = "";
    let effectiveProgramId = programId;
    let resolvedClassId: string | null = classId;

    if (isGeneralCourseResource) {
      resolvedClassId = null;
      const { data: progData, error: progErr } = await supabase
        .from("diploma_programs")
        .select("id, title, drive_folder_id")
        .eq("id", programId)
        .single();

      if (progErr || !progData) {
        return jsonResponse(
          { error: `No se encontró el curso: ${progErr?.message || "ID no existe"}` },
          404,
        );
      }

      effectiveProgramId = progData.id;
      targetFolderId = normalizeDriveFolderId(progData.drive_folder_id);

      const progTitle = (progData.title || "Curso").trim().replace(/[\\/:*?"<>|]/g, "-");
      const originalFileName = file.name || "documento.pdf";
      formattedFileName = `[General - ${progTitle}] ${originalFileName}`;
    } else {
      // 4. Consultar datos de la clase y del programa para armar nomenclatura y buscar carpeta
      const { data: classData, error: classErr } = await supabase
        .from("class_sessions")
        .select("id, title, order_index, drive_folder_id, program_id")
        .eq("id", classId)
        .single();

      if (classErr || !classData) {
        return jsonResponse(
          { error: `No se encontró la clase: ${classErr?.message || "ID no existe"}` },
          404,
        );
      }

      // Consultar programa para obtener drive_folder_id global si la clase no tiene uno específico
      let programDriveFolderId: string | null = null;
      effectiveProgramId = classData.program_id || programId;
      if (effectiveProgramId) {
        const { data: progData } = await supabase
          .from("diploma_programs")
          .select("id, title, drive_folder_id")
          .eq("id", effectiveProgramId)
          .maybeSingle();
        if (progData) {
          programDriveFolderId = progData.drive_folder_id;
        }
      }

      const orderNum = classData.order_index ?? 1;
      const classTitle = (classData.title || "Clase").trim();
      const originalFileName = file.name || "documento.pdf";

      targetFolderId =
        normalizeDriveFolderId(classData.drive_folder_id) ||
        normalizeDriveFolderId(programDriveFolderId);

      const formattedOrder = String(orderNum).padStart(2, "0");
      const sanitizedClassTitle = classTitle.replace(/[\\/:*?"<>|]/g, "-");
      formattedFileName = `[Clase ${formattedOrder} - ${sanitizedClassTitle}] ${originalFileName}`;
    }

    if (!targetFolderId) {
      return jsonResponse(
        {
          error:
            "No se ha configurado la carpeta de Google Drive para este curso. El administrador debe vincular el enlace de la carpeta en la pestaña 'Configuración' del curso.",
        },
        400,
      );
    }

    // 8. Subida Multipart a Google Drive API v3 (usando el accessToken obtenido arriba)
    const metadata: Record<string, unknown> = {
      name: formattedFileName,
      mimeType: file.type || "application/pdf",
    };

    if (targetFolderId) {
      metadata.parents = [targetFolderId];
    }

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileBuffer = await file.arrayBuffer();

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaPartHeader = `${delimiter}Content-Type: ${file.type || "application/pdf"}\r\n\r\n`;

    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    const mediaHeaderBytes = encoder.encode(mediaPartHeader);
    const closeBytes = encoder.encode(closeDelimiter);

    // Combinar los bytes del cuerpo multipart
    const totalLength =
      metadataBytes.length +
      mediaHeaderBytes.length +
      fileBuffer.byteLength +
      closeBytes.length;

    const multipartBody = new Uint8Array(totalLength);
    let offset = 0;

    multipartBody.set(metadataBytes, offset);
    offset += metadataBytes.length;

    multipartBody.set(mediaHeaderBytes, offset);
    offset += mediaHeaderBytes.length;

    multipartBody.set(new Uint8Array(fileBuffer), offset);
    offset += fileBuffer.byteLength;

    multipartBody.set(closeBytes, offset);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
    );

    if (!uploadRes.ok) {
      const uploadErr = await uploadRes.text();
      return jsonResponse(
        { error: `Error de Google Drive API al subir archivo: ${uploadErr}` },
        500,
      );
    }

    const driveFile = await uploadRes.json();
    const fileId = driveFile.id;
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;

    // 9. Asignar permiso público de lectura para que los estudiantes lo vean en el iframe sin pedir permisos
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone",
          }),
        },
      );
    } catch (permErr) {
      console.warn("Aviso: no se pudo asignar permiso público automático:", permErr);
    }

    // 10. Guardar en la tabla 'resources' de Supabase
    const resourcePayload = {
      class_id: resolvedClassId,
      program_id: effectiveProgramId,
      title: (customTitle && customTitle.trim()) || formattedFileName,
      resource_type: resourceType === "presentation" ? "presentation" : "pdf",
      provider: "drive",
      url: previewUrl,
      is_visible: true,
      allow_download: allowDownload,
    };

    let finalInsertedResource = null;
    const { data: insertedResource, error: insertErr } = await supabase
      .from("resources")
      .insert([resourcePayload])
      .select()
      .single();

    if (insertErr) {
      console.error("Error guardando en tabla resources:", insertErr);
      if (
        insertErr.message?.includes("allow_download") ||
        insertErr.details?.includes("allow_download") ||
        JSON.stringify(insertErr).includes("allow_download")
      ) {
        console.warn("Reintentando guardado de recurso sin allow_download...");
        const fallbackPayload = { ...resourcePayload };
        delete (fallbackPayload as any).allow_download;
        const { data: retryData, error: retryErr } = await supabase
          .from("resources")
          .insert([fallbackPayload])
          .select()
          .single();
        if (retryErr) {
          console.error("Error en reintento de guardado:", retryErr);
        } else {
          finalInsertedResource = retryData;
        }
      }
    } else {
      finalInsertedResource = insertedResource;
    }

    // Si es presentación principal y pertenece a una clase, también actualizar presentation_url en class_sessions
    if (resolvedClassId && resourceType === "presentation") {
      await supabase
        .from("class_sessions")
        .update({ presentation_url: previewUrl })
        .eq("id", resolvedClassId);
    }

    return jsonResponse({
      success: true,
      fileId,
      previewUrl,
      formattedFileName,
      targetFolderId: targetFolderId || "Raíz de la cuenta",
      resource: finalInsertedResource,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error inesperado en upload-pdf-drive:", err);
    return jsonResponse({ error: `Error inesperado: ${msg}` }, 500);
  }
});
