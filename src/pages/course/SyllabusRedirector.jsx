import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function SyllabusRedirector() {
  const { programId } = useParams();
  const navigate = useNavigate();

  const cleanProgramId = programId ? decodeURIComponent(programId).replace(/\s+/g, '-').trim() : '';

  useEffect(() => {
    async function redirect() {
      if (!cleanProgramId) {
        navigate('/portal');
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('modules')
          .select('id')
          .eq('program_id', cleanProgramId)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle();
          
        if (error || !data) {
          console.error("No se encontró módulo principal para el curso", error);
          navigate(`/dashboard/${cleanProgramId}`);
        } else {
          // Redirigir al detalle del módulo (que lista los subtemas)
          navigate(`/module/${data.id}`);
        }
      } catch (err) {
        console.error(err);
        navigate(`/dashboard/${cleanProgramId}`);
      }
    }
    
    redirect();
  }, [programId, navigate]);

  return (
    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <h2>Cargando contenido...</h2>
    </div>
  );
}
