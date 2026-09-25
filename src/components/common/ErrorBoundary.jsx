import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: true };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Error no capturado:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/portal';
  };

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV);

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b1528 0%, #172c54 100%)',
          padding: '2rem',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: '#ef4444'
            }}>
              <AlertCircle size={32} />
            </div>

            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              margin: '0 0 0.5rem',
              color: '#ffffff'
            }}>
              Ha ocurrido una interrupción
            </h1>

            <p style={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.5,
              margin: '0 0 2rem'
            }}>
              Ocurrió un problema inesperado al cargar esta sección. Puedes recargar la página o volver al portal principal.
            </p>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #0077ff 100%)',
                  color: '#050c1a',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.15s'
                }}
              >
                <RotateCcw size={16} />
                Recargar página
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer'
                }}
              >
                <Home size={16} />
                Ir al Portal
              </button>
            </div>

            {this.state.error && (
              <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                <button
                  type="button"
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {this.state.showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos (Dev Mode)'}
                </button>

                {this.state.showDetails && (
                  <pre style={{
                    marginTop: '0.75rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#f87171',
                    overflowX: 'auto',
                    maxHeight: '200px'
                  }}>
                    {this.state.error.toString()}
                    {'\n'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
