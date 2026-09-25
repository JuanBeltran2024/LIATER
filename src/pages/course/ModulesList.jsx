import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { BookOpen, ArrowRight, ArrowLeft } from 'lucide-react';

export default function ModulesList() {
  const { programId } = useParams();
  const [modulesList, setModulesList] = useState([]);
  const [loading, setLoading] = useState(true);

  const cleanProgramId = programId ? decodeURIComponent(programId).replace(/\s+/g, '-').trim() : '';

  useEffect(() => {
    async function fetchModules() {
      if (!cleanProgramId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('modules')
          .select('*')
          .eq('program_id', cleanProgramId)
          .order('order_index', { ascending: true });
        
        if (error) throw error;
        setModulesList(data || []);

        // Actualizar contexto global para el Sidebar
        const { data: progData } = await supabase
          .from('diploma_programs')
          .select('program_type')
          .eq('id', cleanProgramId)
          .maybeSingle();

        localStorage.setItem('activeProgramId', cleanProgramId);
        if (progData?.program_type) {
          localStorage.setItem('activeProgramType', progData.program_type);
        }
        window.dispatchEvent(new Event('programContextChanged'));
      } catch (err) {
        console.error('Error fetching modules:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchModules();
  }, [programId]);

  if (loading) {
    return (
      <div style={{ width: '100%', padding: '1rem 0' }}>
        <div className="skeleton" style={{ width: '250px', height: '36px', marginBottom: '1rem' }}></div>
        <div className="skeleton" style={{ width: '180px', height: '20px', marginBottom: '2rem' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-lg)' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-lg)' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-lg)' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-lg)' }}></div>
        </div>
      </div>
    );
  }

  if (modulesList.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>Aún no hay módulos creados</h2>
        <p>Los módulos del programa aparecerán aquí cuando sean publicados.</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>
      {/* BOTÓN DE RETORNO */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={`/dashboard/${cleanProgramId}`} className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
          <ArrowLeft size={14} /> Volver al Inicio del Programa
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Módulos del Programa</h1>
        <p className="page-description">Selecciona un módulo para explorar sus contenidos y clases en vivo.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {modulesList.map((m, index) => (
          <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--navy) 0%, #1e2e52 100%)',
                color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', fontWeight: 800, flexShrink: 0
              }}>
                {m.order_index ?? (index + 1)}
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', margin: 0, lineHeight: 1.3 }}>
                {m.title}
              </h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexGrow: 1, lineHeight: 1.5 }}>
              {m.description || 'Sin descripción disponible.'}
            </p>

            <Link to={`/module/${m.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
              Ver Módulo <ArrowRight size={16} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
