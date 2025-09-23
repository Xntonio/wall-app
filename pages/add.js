import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// REEMPLAZA CON TUS CREDENCIALES DE SUPABASE
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'tu-clave-publica'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function WallDigital() {
  // Estados
  const [texto, setTexto] = useState('')
  const [nombre, setNombre] = useState('')
  const [mensajes, setMensajes] = useState([])
  const [isOnline, setIsOnline] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clickPosition, setClickPosition] = useState(null)
  const [status, setStatus] = useState('')
  
  // Referencias
  const wallContainerRef = useRef(null)
  const refreshIntervalRef = useRef(null)

  // ========================================
  // FUNCIONES DE BASE DE DATOS
  // ========================================

  const checkConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('Notes')
        .select('count', { count: 'exact' })
        .limit(1)
      
      if (error) throw error
      setIsOnline(true)
      return true
    } catch (error) {
      console.error('Error de conexión:', error)
      setIsOnline(false)
      return false
    }
  }

  const cargarMensajes = async () => {
    if (!isOnline) return

    try {
      const now = Date.now()
      const oneMinuteAgo = now - (60 * 1000)
      
      const { data, error } = await supabase
        .from('Notes')
        .select('*')
        .gte('created_at', new Date(oneMinuteAgo).toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const mensajesConTimer = data.map(note => ({
        id: note.id,
        texto: note.texto,
        nombre: note.nombre,
        x: note.position_x || Math.random() * 80 + 10,
        y: note.position_y || Math.random() * 80 + 10,
        createdAt: new Date(note.created_at).getTime(),
        expirationTime: new Date(note.created_at).getTime() + (60 * 1000)
      }))

      setMensajes(mensajesConTimer)
    } catch (error) {
      console.error('Error cargando mensajes:', error)
      setIsOnline(false)
      showToast('Error conectando a Supabase', 'error')
    }
  }

  const agregarMensaje = async () => {
    if (isLoading || !isOnline) return
    
    if (!texto.trim()) {
      showToast('Por favor, escribe un mensaje', 'error')
      return
    }

    if (!clickPosition) {
      showToast('Primero haz clic en el muro donde quieres colocar tu mensaje', 'error')
      return
    }

    setIsLoading(true)
    setStatus('⏳ Publicando mensaje...')

    try {
      const { data, error } = await supabase
        .from('Notes')
        .insert([{
          nombre: nombre.trim() || 'Anónimo',
          texto: texto.trim(),
          position_x: clickPosition.xPercent,
          position_y: clickPosition.yPercent
        }])
        .select()
        .single()

      if (error) throw error

      // Limpiar formulario
      setTexto('')
      setNombre('')
      setClickPosition(null)
      
      showToast('¡Mensaje publicado correctamente!', 'success')
      
      // Recargar mensajes
      await cargarMensajes()

    } catch (error) {
      console.error('Error enviando mensaje:', error)
      showToast('Error al publicar mensaje', 'error')
    } finally {
      setIsLoading(false)
      setStatus('')
    }
  }

  // ========================================
  // FUNCIONES DE INTERFAZ
  // ========================================

  const handleWallClick = (e) => {
    if (!isOnline) {
      showToast('Sin conexión a Supabase', 'error')
      return
    }
    
    const rect = wallContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setClickPosition({
      x,
      y,
      xPercent: (x / rect.width) * 100,
      yPercent: (y / rect.height) * 100
    })
  }

  const showToast = (message, type) => {
    setStatus(message)
    setTimeout(() => setStatus(''), 3000)
  }

  const limpiarMensajesExpirados = () => {
    const now = Date.now()
    setMensajes(prev => prev.filter(msg => msg.expirationTime > now))
  }

  const getTimeLeft = (expirationTime) => {
    const timeLeft = expirationTime - Date.now()
    if (timeLeft <= 0) return null
    
    const seconds = Math.ceil(timeLeft / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${remainingSeconds}s`
  }

  // ========================================
  // EFECTOS
  // ========================================

  useEffect(() => {
    const init = async () => {
      const connected = await checkConnection()
      if (connected) {
        await cargarMensajes()
        // Actualizar mensajes cada 5 segundos
        refreshIntervalRef.current = setInterval(cargarMensajes, 5000)
      } else {
        // Reintentar conexión cada 10 segundos
        const retryInterval = setInterval(async () => {
          if (!isOnline) {
            await checkConnection()
          }
        }, 10000)
        
        return () => clearInterval(retryInterval)
      }
    }

    init()

    // Limpiar mensajes expirados cada segundo
    const cleanupInterval = setInterval(limpiarMensajesExpirados, 1000)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      clearInterval(cleanupInterval)
    }
  }, [isOnline])

  // ========================================
  // RENDER
  // ========================================

  const getButtonText = () => {
    if (!isOnline) return '⌘ Sin conexión'
    if (isLoading) return '⏳ Publicando...'
    if (clickPosition && texto.trim()) return '✅ Publicar Mensaje'
    if (clickPosition) return '💬 Escribe tu mensaje'
    return '📍 Haz clic en el muro primero'
  }

  const isButtonDisabled = !texto.trim() || !clickPosition || isLoading || !isOnline

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        padding: '1rem',
        textAlign: 'center',
        color: 'white',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 2px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontWeight: '700' }}>
          🌐 Muro Digital Compartido
        </h1>
        <p style={{ opacity: '0.9', fontSize: '16px' }}>
          Mensajes temporales visibles para todos • Duración: 1 minuto
        </p>
      </div>

      {/* Container */}
      <div style={{
        display: 'flex',
        flex: 1,
        gap: '20px',
        padding: '20px',
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%',
        flexWrap: 'wrap'
      }}>
        {/* Wall Section */}
        <div style={{
          flex: '4',
          minWidth: '300px',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '25px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '12px 25px',
            borderRadius: '30px',
            fontSize: '20px',
            fontWeight: 'bold',
            zIndex: 10,
            backdropFilter: 'blur(15px)'
          }}>
            Muro Colaborativo
          </div>
          
          <div
            ref={wallContainerRef}
            onClick={handleWallClick}
            style={{
              position: 'relative',
              width: '100%',
              height: '600px',
              overflow: 'hidden',
              cursor: 'crosshair',
              background: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 25%, #fecfef 50%, #a8edea 75%, #fed6e3 100%)',
              backgroundSize: '400% 400%',
              animation: 'gradientFlow 12s ease infinite'
            }}
          >
            {/* Click indicator */}
            {clickPosition && (
              <div style={{
                position: 'absolute',
                width: '24px',
                height: '24px',
                background: '#4285f4',
                borderRadius: '50%',
                left: clickPosition.x + 'px',
                top: clickPosition.y + 'px',
                transform: 'translate(-50%, -50%)',
                animation: 'clickPulse 0.6s ease-out',
                pointerEvents: 'none',
                zIndex: 1000
              }} />
            )}

            {/* Messages */}
            {mensajes.map((mensaje) => {
              const timeLeft = getTimeLeft(mensaje.expirationTime)
              if (!timeLeft) return null
              
              const rect = wallContainerRef.current?.getBoundingClientRect()
              const pixelX = rect ? (mensaje.x / 100) * rect.width : 0
              const pixelY = rect ? (mensaje.y / 100) * rect.height : 0
              
              return (
                <div
                  key={mensaje.id}
                  style={{
                    position: 'absolute',
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #4285f4',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    minWidth: '130px',
                    maxWidth: '280px',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
                    transform: 'translate(-50%, -50%)',
                    left: pixelX + 'px',
                    top: pixelY + 'px',
                    zIndex: 100
                  }}
                >
                  <div style={{
                    fontWeight: '600',
                    marginBottom: '6px',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    wordWrap: 'break-word',
                    color: '#333'
                  }}>
                    {mensaje.texto}
                  </div>
                  
                  {mensaje.nombre && (
                    <div style={{
                      fontSize: '11px',
                      color: '#666',
                      fontStyle: 'italic',
                      marginBottom: '6px',
                      fontWeight: '500'
                    }}>
                      — {mensaje.nombre}
                    </div>
                  )}
                  
                  <div style={{
                    fontSize: '10px',
                    color: '#e53e3e',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    background: 'rgba(229, 62, 62, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '10px',
                    border: '1px solid rgba(229, 62, 62, 0.3)'
                  }}>
                    ⏰ {timeLeft}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '25px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            Mensajes activos: {mensajes.length}
          </div>
        </div>

        {/* Controls Section */}
        <div style={{
          flex: '1',
          minWidth: '300px',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.3)',
          padding: '30px',
          height: 'fit-content'
        }}>
          <h2 style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '25px',
            textAlign: 'center'
          }}>
            Nuevo Mensaje
          </h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              color: '#555',
              marginBottom: '8px',
              fontSize: '15px'
            }}>
              💬 Tu Mensaje:
            </label>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe aquí tu mensaje..."
              maxLength="80"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px',
                background: '#fafafa'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              color: '#555',
              marginBottom: '8px',
              fontSize: '15px'
            }}>
              👤 Tu Nombre:
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="¿Cómo te llamas?"
              maxLength="20"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px',
                background: '#fafafa'
              }}
            />
          </div>

          <button
            onClick={agregarMensaje}
            disabled={isButtonDisabled}
            style={{
              width: '100%',
              padding: '16px',
              background: isButtonDisabled ? '#cbd5e0' : 'linear-gradient(135deg, #4285f4, #1976d2)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
              marginTop: '15px'
            }}
          >
            {getButtonText()}
          </button>

          <div style={{
            marginTop: '25px',
            padding: '20px',
            background: 'linear-gradient(135deg, #f7fafc, #edf2f7)',
            borderRadius: '12px',
            borderLeft: '5px solid #4285f4'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                marginRight: '10px',
                background: isOnline ? '#48bb78' : '#f56565'
              }} />
              <span>{isOnline ? 'Conectado a Supabase' : 'Sin conexión a Supabase'}</span>
            </div>
            
            <div style={{
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.5'
            }}>
              <strong>📋 Cómo usar:</strong><br/>
              • Haz clic donde quieres tu mensaje<br/>
              • Escribe tu texto y nombre<br/>
              • Presiona el botón para publicar<br/>
              • ¡Todos verán tu mensaje por 1 minuto!
            </div>
          </div>

          {status && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              borderRadius: '8px',
              background: status.includes('Error') ? '#fee' : '#efe',
              color: status.includes('Error') ? '#c53030' : '#38a169',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {status}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes clickPulse {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}