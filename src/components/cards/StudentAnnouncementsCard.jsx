import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Megaphone, Info, AlertTriangle, Clock } from 'lucide-react';
import { formatShortDate } from '@/utils/dateUtils';

export default function StudentAnnouncementsCard({ studentId, enrolledProgramIds = [] }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      if (!studentId) return;
      try {
        setLoading(true);
        // Traer anuncios globales (program_id IS NULL) o específicos de programas inscritos
        let query = supabase
          .from('announcements')
          .select('id, title, body, tag, created_at, program_id, teacher_profiles(name)')
          .order('created_at', { ascending: false })
          .limit(5);
        
        // Supabase or logic requires formatting
        if (enrolledProgramIds.length > 0) {
          query = query.or(`program_id.is.null,program_id.in.(${enrolledProgramIds.join(',')})`);
        } else {
          query = query.is('program_id', null);
        }

        query = query.in('target_role', ['all', 'student']);

        const { data, error } = await query;
        if (error) throw error;
        setAnnouncements(data || []);
      } catch (err) {
        console.error('Error fetching announcements:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnnouncements();
  }, [studentId, enrolledProgramIds]);

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 4px 12px rgba(20,33,61,0.08)' }}>
        <div style={{ height: '20px', width: '120px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}></div>
        <div style={{ height: '60px', width: '100%', background: '#f1f5f9', borderRadius: '6px', animation: 'pulse 1.5s infinite' }}></div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return null; // Opcional: mostrar algo como "No hay anuncios recientes" pero para limpiar la UI mejor no mostrar nada
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 12px rgba(20,33,61,0.06)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'var(--gold)', color: 'var(--navy)', padding: '0.4rem', borderRadius: '8px' }}>
          <Megaphone size={18} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--navy)', fontWeight: 800 }}>Tablero de Anuncios</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {announcements.map((a) => {
          const isUrgent = a.tag === 'urgent';
          const isInfo = a.tag === 'info';
          
          let icon = <Megaphone size={16} />;
          let iconColor = 'var(--text-muted)';
          let badgeBg = '#f1f5f9';
          
          if (isUrgent) {
            icon = <AlertTriangle size={16} />;
            iconColor = '#dc2626';
            badgeBg = '#fee2e2';
          } else if (isInfo) {
            icon = <Info size={16} />;
            iconColor = '#2563eb';
            badgeBg = '#dbeafe';
          }

          return (
            <div key={a.id} style={{ 
              padding: '1rem', 
              borderRadius: '8px', 
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {isUrgent && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: '#dc2626' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)', paddingLeft: isUrgent ? '0.5rem' : '0' }}>
                  {a.title}
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {a.tag !== 'general' && (
                    <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: badgeBg, color: iconColor, fontWeight: 700, textTransform: 'uppercase' }}>
                      {a.tag}
                    </span>
                  )}
                </div>
              </div>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.86rem', color: 'var(--text-color)', lineHeight: 1.5, paddingLeft: isUrgent ? '0.5rem' : '0', whiteSpace: 'pre-line' }}>
                {a.body}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: isUrgent ? '0.5rem' : '0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={12} /> {formatShortDate(a.created_at)}
                </span>
                <span>Por: {a.teacher_profiles?.name || 'Administración'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
