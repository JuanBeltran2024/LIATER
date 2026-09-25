import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertCircle, CheckCircle, Upload, Trash2, Image as ImageIcon, Eye, EyeOff, Video, MessageCircle, Folder, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { uploadProgramCover } from '@/services/programService';

export default function AdminSettingsTab() {
  const { currentUser } = useAuth();
  const { programId } = useParams();
  const navigate = useNavigate();
  const role = currentUser?.role;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [programType, setProgramType] = useState('diplomado');
  const [imageUrl, setImageUrl] = useState(null);
  const [isPublished, setIsPublished] = useState(true);
  const [meetUrl, setMeetUrl] = useState('');
  const [whatsappGroupId, setWhatsappGroupId] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  
  // Estados para subida de imagen de portada
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    async function fetchProgram() {
      if (!programId) return;
      try {
        const { data, error } = await supabase
          .from('diploma_programs')
          .select('title, description, program_type, image_url, is_published, status, meet_url, whatsapp_group_id, drive_folder_id')
          .eq('id', programId)
          .single();
        
        if (error) throw error;
        setTitle(data.title || '');
        setDescription(data.description || '');
        setProgramType(data.program_type || 'diplomado');
        setImageUrl(data.image_url || null);
        setIsPublished(data.is_published !== false && data.status !== 'draft');
        setMeetUrl(data.meet_url || '');
        setWhatsappGroupId(data.whatsapp_group_id || '');
        setDriveFolderId(data.drive_folder_id || '');
        if (data.image_url) {
          setCoverPreview(data.image_url);
        }
      } catch (err) {
        console.error('Error fetching program:', err);
        setError('No se pudo cargar la información del programa.');
      } finally {
        setLoading(false);
      }
    }
    fetchProgram();
  }, [programId]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar Formato (JPG, PNG, WebP)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Formato no permitido. Selecciona únicamente imágenes JPG, PNG o WebP.');
      return;
    }

    // Validar Tamaño (Máx 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('La imagen excede el límite máximo de 5MB.');
      return;
    }

    setError('');
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setImageUrl(null);
  };

  const handleTogglePublish = async () => {
    const nextState = !isPublished;
    setError('');
    setSuccess('');
    try {
      const { error: updateError } = await supabase
        .from('diploma_programs')
        .update({ 
          is_published: nextState, 
          status: nextState ? 'published' : 'draft' 
        })
        .eq('id', programId);

      if (updateError) throw updateError;

      setIsPublished(nextState);
      setSuccess(nextState ? 'Programa habilitado y publicado correctamente.' : 'Programa inhabilitado (oculto para estudiantes).');
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      setError('No se pudo cambiar el estado del programa.');
    }
  };

  const handleDeleteProgram = () => {
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  };

  const confirmDeleteProgram = async () => {
    if (deleteConfirmText !== title) return;

    try {
      // 1. Eliminar inscripciones vinculadas
      await supabase.from('enrollments').delete().eq('diploma_id', programId);

      // 2. Eliminar tareas y cuestionarios vinculados
      try {
        await supabase.from('assignments').delete().eq('program_id', programId);
        await supabase.from('quizzes').delete().eq('program_id', programId);
      } catch {
        // Ignorar si las tablas aún no tienen datos
      }

      // 3. Eliminar clases vinculadas
      await supabase.from('class_sessions').delete().eq('program_id', programId);

      // 4. Eliminar módulos del programa (cascada a subtemas y clases)
      await supabase.from('modules').delete().eq('program_id', programId);
      await supabase.from('modules').delete().eq('diploma_id', programId);

      // 5. Eliminar el programa principal
      const { error: deleteError } = await supabase
        .from('diploma_programs')
        .delete()
        .eq('id', programId);

      if (deleteError) throw deleteError;

      setShowDeleteModal(false);
      navigate('/portal');
    } catch (err) {
      console.error('Error al eliminar el programa y su contenido:', err);
      setError('Hubo un error al intentar eliminar el programa.');
      setShowDeleteModal(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      let finalImageUrl = imageUrl;

      // Subir nueva imagen si fue seleccionada
      if (coverFile) {
        setUploadingCover(true);
        const { publicUrl, error: uploadErr } = await uploadProgramCover(coverFile, programId);
        setUploadingCover(false);

        if (uploadErr) {
          throw new Error('Error al subir la imagen de portada: ' + uploadErr.message);
        }
        if (publicUrl) {
          finalImageUrl = publicUrl;
        }
      }

      // Actualizar registro en base de datos
      const { error: updateError } = await supabase
        .from('diploma_programs')
        .update({ 
          title, 
          description,
          image_url: finalImageUrl,
          meet_url: meetUrl,
          whatsapp_group_id: whatsappGroupId,
          drive_folder_id: driveFolderId.trim() || null
        })
        .eq('id', programId);
      
      if (updateError) throw updateError;
      
      setImageUrl(finalImageUrl);
      setCoverFile(null);
      setSuccess('Datos e imagen del programa guardados correctamente.');
    } catch (err) {
      console.error('Error saving program:', err);
      setError(err.message || 'Hubo un error al guardar los cambios.');
    } finally {
      setSaving(false);
      setUploadingCover(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Acceso Denegado</h2>
        <p>Esta pestaña es exclusiva para administradores.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando configuración...</div>;
  }

  const isButtonDisabled = saving || uploadingCover;

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--navy)', marginBottom: '0.25rem' }}>
          Configurar Curso
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Actualiza la información básica, enlaces y la carpeta de almacenamiento de Google Drive para este programa.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label htmlFor="settings-title-input" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
              Título del Programa
            </label>
            <input 
              id="settings-title-input"
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>

          <div>
            <label htmlFor="settings-description-input" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
              Descripción
            </label>
            <textarea 
              id="settings-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', resize: 'vertical' }}
            />
          </div>

          <div>
            <label htmlFor="settings-meet-input" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '8px' }}>
              <Video size={16} /> Enlace Global de Clase en Vivo (Meet/Zoom)
            </label>
            <input 
              id="settings-meet-input"
              type="url"
              placeholder="https://meet.google.com/..."
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>

          <div>
            <label htmlFor="settings-whatsapp-input" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '8px' }}>
              <MessageCircle size={16} /> ID Grupo WhatsApp (Bot)
            </label>
            <input 
              id="settings-whatsapp-input"
              type="text"
              placeholder="Ej: 120363xxxxxxxx@g.us"
              value={whatsappGroupId}
              onChange={(e) => setWhatsappGroupId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              El bot enviará recordatorios automáticos 10 horas antes de cada clase a este ID de grupo.
            </p>
          </div>

          {/* CARPETA DE GOOGLE DRIVE DEL CURSO */}
          <div>
            <label htmlFor="settings-drive-input" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '8px' }}>
              <Folder size={16} /> Carpeta de Google Drive (Materiales y PDFs)
            </label>
            <input 
              id="settings-drive-input"
              type="text"
              placeholder="https://drive.google.com/drive/folders/... o ID de la carpeta"
              value={driveFolderId}
              onChange={(e) => setDriveFolderId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Los PDFs y presentaciones que suban los profesores para las clases de este curso se guardarán automáticamente en esta carpeta.
            </p>
          </div>

          {/* SECCIÓN DE GESTIÓN DE PORTADA */}
          <div>
            <label htmlFor="settings-cover-input" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
              Imagen de Portada
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {coverPreview ? (
                <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#f8fafc' }}>
                  <img src={coverPreview} alt="Portada del programa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '8px' }}>
                    <label 
                      htmlFor="settings-cover-input" 
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('settings-cover-input')?.click(); } }}
                      style={{ background: 'var(--navy)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Upload size={14} /> Cambiar
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <label 
                  htmlFor="settings-cover-input"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('settings-cover-input')?.click(); } }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '6px', background: '#f8fafc', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <ImageIcon size={32} color="var(--navy)" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>Cargar Imagen de Portada</span>
                  <span style={{ fontSize: '0.78rem' }}>JPG, PNG o WebP (Máximo 5MB)</span>
                </label>
              )}

              <input 
                id="settings-cover-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button 
              type="submit" 
              disabled={isButtonDisabled} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700 }}
            >
              <Save size={18} />
              <span>
                {uploadingCover ? 'Subiendo imagen...' : saving ? 'Guardando...' : 'Guardar Cambios'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleTogglePublish}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '4px',
                fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                background: isPublished ? '#fffbe6' : '#eff6ff',
                color: isPublished ? '#d97706' : 'var(--navy)',
                border: isPublished ? '1px solid #fca311' : '1px solid var(--navy)',
                transition: 'all 0.2s'
              }}
            >
              {isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>{isPublished ? 'Inhabilitar Programa' : 'Habilitar Programa'}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteProgram}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '4px',
                fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                marginLeft: 'auto', transition: 'all 0.2s'
              }}
            >
              <Trash2 size={16} />
              <span>Eliminar Programa</span>
            </button>
          </div>
        </div>
      </form>

      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={24} /> Confirmar Eliminación
              </h3>
              <button onClick={() => setShowDeleteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Estás a punto de eliminar permanentemente este programa. Esta acción <strong>no se puede deshacer</strong> y borrará en cascada:
            </p>
            <ul style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', paddingLeft: '1.5rem', lineHeight: 1.5 }}>
              <li>Todas las inscripciones de estudiantes.</li>
              <li>Todos los módulos, temas y clases en vivo.</li>
              <li>Todas las tareas y cuestionarios asociados.</li>
            </ul>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Por favor, escribe <strong>{title}</strong> para confirmar:
            </p>
            
            <input 
              type="text" 
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}
              placeholder={title}
            />
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteProgram}
                disabled={deleteConfirmText !== title}
                style={{ 
                  padding: '8px 16px', 
                  border: 'none', 
                  background: deleteConfirmText === title ? '#dc2626' : '#fca5a5', 
                  color: 'white', 
                  borderRadius: '4px', 
                  cursor: deleteConfirmText === title ? 'pointer' : 'not-allowed', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={16} /> Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificación en la esquina inferior derecha */}
      {success && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '0.86rem',
          zIndex: 9999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'fadeSlideUp 0.3s ease-out'
        }}>
          <CheckCircle size={18} color="#10B981" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
