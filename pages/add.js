import { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabaseClient'

export default function WallDigital() {
  // Estados
  const [texto, setTexto] = useState('')
  const [nombre, setNombre] = useState('')
  const [mensajes, setMensajes] = useState([])
  const [isOnline, setIsOnline] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clickPosition, setClickPosition] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('')
  
  // Referencias
  const wallContainerRef = useRef(null)
  const realtimeChannelRef = useRef(null)

  // ========================================
  // FUNCIONES DE NOTIFICACIONES
  // ========================================

  const showToast = (message, type = 'info') => {
    setToastMessage(message)
    setToastType(type)
    setTimeout(() => {
      setToastMessage('')
      setToastType('')
    }, 4000)
  }

  // ========================================
  // FUNCIONES DE BASE DE DATOS
  // ========================================

  const checkConnection = async () => {
    try {
      console.log('Verificando conexión a Supabase...')
      
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .limit(1)
      
      if (error) {
        console.error('Error en checkConnection:', error)
        throw error
      }
      
      console.log('Conexión exitosa a Supabase')
      setIsOnline(true)
      return true
    } catch (error) {
      console.error('Error de conexión:', error)
      setIsOnline(false)
      showToast(`Sin conexión: ${error.message}`, 'error')
      return false
    }
  }

  const cargarMensajes = async () => {
    if (!isOnline) return

    try {
      console.log('Cargando mensajes...')
      
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - (60 * 1000))
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .gte('created_at', oneMinuteAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error cargando mensajes:', error)
        throw error
      }

      console.log(`Mensajes cargados: ${data?.length || 0}`)

      const mensajesConTimer = (data || []).map(msg => ({
        id: msg.id,
        texto: msg.text || msg.texto,
        nombre: msg.nickname || msg.nombre,
        x: msg.position_x || Math.random() * 80 + 10,
        y: msg.position_y || Math.random() * 80 + 10,
        createdAt: new Date(msg.created_at).getTime(),
        expirationTime: new Date(msg.created_at).getTime() + (60 * 1000)
      }))

      setMensajes(mensajesConTimer)
    } catch (error) {
      console.error('Error cargando mensajes:', error)
      setIsOnline(false)
      showToast('Error conectando a la base de datos', 'error')
    }
  }

  // ========================================
  // CONFIGURACIÓN DE TIEMPO REAL
  // ========================================

  const setupRealtime = () => {
    // Limpiar canal anterior si existe
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    console.log('Configurando suscripción en tiempo real...')

    // Crear canal para escuchar cambios en la tabla messages
    const channel = supabase
      .channel('messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Nuevo mensaje recibido:', payload.new)
          
          const nuevoMensaje = {
            id: payload.new.id,
            texto: payload.new.text || payload.new.texto,
            nombre: payload.new.nickname || payload.new.nombre,
            x: payload.new.position_x || Math.random() * 80 + 10,
            y: payload.new.position_y || Math.random() * 80 + 10,
            createdAt: new Date(payload.new.created_at).getTime(),
            expirationTime: new Date(payload.new.created_at).getTime() + (60 * 1000)
          }

          // Agregar el nuevo mensaje al estado actual sin eliminar los existentes
          setMensajes(prevMensajes => {
            // Verificar si el mensaje ya existe (evitar duplicados)
            const existe = prevMensajes.some(msg => msg.id === nuevoMensaje.id)
            if (existe) return prevMensajes
            
            // Agregar al principio de la lista
            return [nuevoMensaje, ...prevMensajes]
          })

          // Mostrar notificación de nuevo mensaje
          showToast(`Nuevo mensaje de ${nuevoMensaje.nombre || 'Anónimo'}`, 'info')
        }
      )
      .subscribe((status) => {
        console.log('Estado de suscripción:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Suscripción en tiempo real activa')
          showToast('Tiempo real activado', 'success')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error en canal de tiempo real')
          showToast('Error en tiempo real', 'error')
        }
      })

    realtimeChannelRef.current = channel
  }

  const agregarMensaje = async () => {
    if (isLoading) {
      console.log('Ya hay una operación en curso')
      return
    }
    
    if (!isOnline) {
      showToast('Sin conexión a la base de datos', 'error')
      return
    }
    
    if (!texto.trim()) {
      showToast('Por favor, escribe un mensaje', 'error')
      return
    }

    if (!clickPosition) {
      showToast('Primero haz clic en el muro donde quieres colocar tu mensaje', 'error')
      return
    }

    setIsLoading(true)
    showToast('Guardando mensaje...', 'loading')

    try {
      console.log('Guardando mensaje...')

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          text: texto.trim(),
          nickname: nombre.trim() || 'Anónimo',
          position_x: clickPosition.xPercent,
          position_y: clickPosition.yPercent
        }])
        .select()

      if (error) {
        console.error('Error insertando mensaje:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('No se recibieron datos después de la inserción')
      }

      console.log('Mensaje guardado exitosamente:', data[0])

      // Limpiar formulario
      setTexto('')
      setNombre('')
      setClickPosition(null)
      
      showToast('Mensaje publicado correctamente', 'success')

      // NO necesitamos recargar manualmente porque el tiempo real lo hará automáticamente

    } catch (error) {
      console.error('Error enviando mensaje:', error)
      
      if (error.message.includes('duplicate key')) {
        showToast('Error: Mensaje duplicado', 'error')
      } else if (error.message.includes('permission')) {
        showToast('Error: Sin permisos para guardar', 'error')
      } else if (error.message.includes('network')) {
        showToast('Error: Problemas de conexión', 'error')
        setIsOnline(false)
      } else {
        showToast(`Error al publicar: ${error.message}`, 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ========================================
  // FUNCIONES DE INTERFAZ
  // ========================================

  const handleWallClick = (e) => {
    if (!isOnline) {
      showToast('Sin conexión a la base de datos', 'error')
      return
    }
    
    const rect = wallContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const newPosition = {
      x,
      y,
      xPercent: Math.max(5, Math.min(95, (x / rect.width) * 100)),
      yPercent: Math.max(5, Math.min(95, (y / rect.height) * 100))
    }
    
    setClickPosition(newPosition)
    console.log('Posición seleccionada:', newPosition)
  }

  const limpiarMensajesExpirados = () => {
    const now = Date.now()
    setMensajes(prev => {
      const activos = prev.filter(msg => msg.expirationTime > now)
      if (activos.length !== prev.length) {
        console.log(`Limpiados ${prev.length - activos.length} mensajes expirados`)
      }
      return activos
    })
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
    let mounted = true
    
    const init = async () => {
      console.log('Inicializando WallDigital...')
      
      const connected = await checkConnection()
      
      if (connected && mounted) {
        // Cargar mensajes iniciales
        await cargarMensajes()
        
        // Configurar tiempo real
        setupRealtime()
      } else if (mounted) {
        // Reintentar conexión cada 10 segundos
        const retryInterval = setInterval(async () => {
          if (!isOnline && mounted) {
            console.log('Reintentando conexión...')
            const reconnected = await checkConnection()
            if (reconnected) {
              await cargarMensajes()
              setupRealtime()
            }
          }
        }, 10000)
        
        return () => {
          clearInterval(retryInterval)
          mounted = false
        }
      }
    }

    init()

    // Limpiar mensajes expirados cada segundo
    const cleanupInterval = setInterval(() => {
      if (mounted) {
        limpiarMensajesExpirados()
      }
    }, 1000)

    return () => {
      mounted = false
      clearInterval(cleanupInterval)
      
      // Limpiar suscripción de tiempo real
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [])

  // ========================================
  // RENDER
  // ========================================

  const getButtonText = () => {
    if (!isOnline) return 'Sin conexión'
    if (isLoading) return 'Publicando...'
    if (clickPosition && texto.trim()) return 'Publicar Mensaje'
    if (clickPosition) return 'Escribe tu mensaje'
    return 'Haz clic en el muro primero'
  }

  const getButtonColor = () => {
    if (!isOnline || isLoading) return '#cbd5e0'
    if (clickPosition && texto.trim()) return 'linear-gradient(135deg, #48bb78, #38a169)'
    if (clickPosition) return 'linear-gradient(135deg, #ed8936, #dd6b20)'
    return 'linear-gradient(135deg, #4285f4, #1976d2)'
  }

  const isButtonDisabled = !texto.trim() || !clickPosition || isLoading || !isOnline

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Toast de notificaciones */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toastType === 'success' ? '#48bb78' : 
                     toastType === 'error' ? '#f56565' : 
                     toastType === 'loading' ? '#4285f4' : '#718096',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '10px',
          zIndex: 10000,
          maxWidth: '350px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          animation: 'slideIn 0.3s ease-out',
          fontWeight: '600'
        }}>
          {toastType === 'success' && '✅ '}
          {toastType === 'error' && '❌ '}
          {toastType === 'loading' && '⏳ '}
          {toastMessage}
        </div>
      )}

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
          Muro Digital Compartido
        </h1>
        <p style={{ opacity: '0.9', fontSize: '16px' }}>
          Mensajes temporales en tiempo real • Duración: 1 minuto
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
              cursor: isOnline ? 'crosshair' : 'not-allowed',
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
                    border: timeLeft.includes('s') && parseInt(timeLeft) < 20 ? 
                           '2px solid #f56565' : '2px solid #4285f4',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    minWidth: '130px',
                    maxWidth: '280px',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
                    transform: 'translate(-50%, -50%)',
                    left: pixelX + 'px',
                    top: pixelY + 'px',
                    zIndex: 100,
                    transition: 'all 0.3s ease',
                    animation: 'messageAppear 0.5s ease-out'
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
                    background: timeLeft.includes('s') && parseInt(timeLeft) < 20 ? 
                               'rgba(245, 101, 101, 0.2)' : 'rgba(229, 62, 62, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '10px',
                    border: timeLeft.includes('s') && parseInt(timeLeft) < 20 ? 
                           '1px solid rgba(245, 101, 101, 0.5)' : '1px solid rgba(229, 62, 62, 0.3)'
                  }}>
                    {timeLeft}
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
              Tu Mensaje:
            </label>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe aquí tu mensaje..."
              maxLength="80"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px',
                background: isLoading ? '#f7fafc' : '#fafafa',
                opacity: isLoading ? 0.7 : 1
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
              Tu Nombre:
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="¿Cómo te llamas?"
              maxLength="20"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px',
                background: isLoading ? '#f7fafc' : '#fafafa',
                opacity: isLoading ? 0.7 : 1
              }}
            />
          </div>

          <button
            onClick={agregarMensaje}
            disabled={isButtonDisabled}
            style={{
              width: '100%',
              padding: '16px',
              background: getButtonColor(),
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
              marginTop: '15px',
              transition: 'all 0.3s ease'
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
                background: isOnline ? '#48bb78' : '#f56565',
                animation: 'pulse 2s infinite'
              }} />
              <span>
                {isOnline ? 'Conectado en tiempo real' : 'Sin conexión'}
              </span>
            </div>
            
            <div style={{
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.5'
            }}>
              <strong>Cómo usar:</strong><br/>
              • Haz clic donde quieres tu mensaje<br/>
              • Escribe tu texto y nombre<br/>
              • Presiona el botón para publicar<br/>
              • Los mensajes aparecen automáticamente para todos
            </div>
          </div>
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

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes messageAppear {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  )
}