import { useState, useEffect, useRef } from 'react'

// Simulamos la conexión a Supabase con localStorage para demo
const mockSupabase = {
  from: (table) => ({
    select: (columns) => ({
      gte: (field, date) => ({
        order: (field, options) => ({
          limit: (count) => ({
            then: (callback) => {
              // Simulamos obtener mensajes del localStorage
              const storedMessages = JSON.parse(localStorage.getItem('wallMessages') || '[]')
              const now = Date.now()
              
              // Filtramos mensajes que no han expirado (1 minuto = 60000ms)
              const validMessages = storedMessages.filter(msg => {
                const messageTime = new Date(msg.created_at).getTime()
                return (now - messageTime) < 60000
              })
              
              callback({ data: validMessages, error: null })
              return Promise.resolve({ data: validMessages, error: null })
            }
          })
        })
      })
    }),
    insert: (data) => ({
      select: () => ({
        then: (callback) => {
          // Simulamos insertar mensaje
          const newMessage = {
            ...data[0],
            id: Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString()
          }
          
          const storedMessages = JSON.parse(localStorage.getItem('wallMessages') || '[]')
          storedMessages.unshift(newMessage)
          localStorage.setItem('wallMessages', JSON.stringify(storedMessages))
          
          callback({ data: [newMessage], error: null })
          return Promise.resolve({ data: [newMessage], error: null })
        }
      })
    })
  })
}

export default function WallDigital() {
  // Estados
  const [texto, setTexto] = useState('')
  const [nombre, setNombre] = useState('')
  const [mensajes, setMensajes] = useState([])
  const [isOnline, setIsOnline] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [clickPosition, setClickPosition] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('')
  
  // Referencias
  const wallContainerRef = useRef(null)
  const refreshIntervalRef = useRef(null)

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
      console.log('🔄 Verificando conexión...')
      setIsOnline(true)
      return true
    } catch (error) {
      console.error('❌ Error de conexión:', error)
      setIsOnline(false)
      showToast(`Sin conexión: ${error.message}`, 'error')
      return false
    }
  }

  const cargarMensajes = async () => {
    try {
      console.log('📥 Cargando mensajes...')
      
      // CAMBIO IMPORTANTE: No filtrar por tiempo en la consulta
      // En su lugar, obtener todos los mensajes y filtrar localmente
      const { data, error } = await mockSupabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100) // Aumentamos el límite para asegurar que obtenemos todos los mensajes recientes

      if (error) {
        console.error('❌ Error cargando mensajes:', error)
        throw error
      }

      console.log(`📊 Mensajes obtenidos: ${data?.length || 0}`)

      const now = Date.now()
      
      // Filtrar mensajes que no han expirado (usando tiempo del cliente)
      const mensajesValidos = (data || []).filter(msg => {
        const messageTime = new Date(msg.created_at).getTime()
        const timeElapsed = now - messageTime
        return timeElapsed < 60000 // 1 minuto en milisegundos
      })

      const mensajesConTimer = mensajesValidos.map(msg => ({
        id: msg.id,
        texto: msg.text || msg.texto,
        nombre: msg.nickname || msg.nombre,
        x: msg.position_x || Math.random() * 80 + 10,
        y: msg.position_y || Math.random() * 80 + 10,
        createdAt: new Date(msg.created_at).getTime(),
        expirationTime: new Date(msg.created_at).getTime() + 60000 // 1 minuto exacto
      }))

      setMensajes(mensajesConTimer)
      console.log(`✅ Mensajes válidos cargados: ${mensajesConTimer.length}`)

      // Limpiar mensajes expirados del storage
      limpiarMensajesExpiradosDelStorage()

    } catch (error) {
      console.error('❌ Error cargando mensajes:', error)
      setIsOnline(false)
      showToast('Error conectando a la base de datos', 'error')
    }
  }

  const limpiarMensajesExpiradosDelStorage = () => {
    const storedMessages = JSON.parse(localStorage.getItem('wallMessages') || '[]')
    const now = Date.now()
    
    const validMessages = storedMessages.filter(msg => {
      const messageTime = new Date(msg.created_at).getTime()
      return (now - messageTime) < 60000
    })
    
    localStorage.setItem('wallMessages', JSON.stringify(validMessages))
  }

  const agregarMensaje = async () => {
    if (isLoading) return
    
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
      console.log('💾 Insertando mensaje...')
      
      const datosInsertar = {
        text: texto.trim(),
        nickname: nombre.trim() || 'Anónimo',
        position_x: clickPosition.xPercent,
        position_y: clickPosition.yPercent
      }

      const { data, error } = await mockSupabase
        .from('messages')
        .insert([datosInsertar])
        .select()

      if (error) {
        console.error('❌ Error insertando:', error)
        throw error
      }

      console.log('✅ Mensaje insertado exitosamente')

      // Crear elemento visual inmediatamente
      const nuevoMensaje = {
        id: data[0].id,
        texto: data[0].text,
        nombre: data[0].nickname,
        x: data[0].position_x,
        y: data[0].position_y,
        createdAt: new Date(data[0].created_at).getTime(),
        expirationTime: new Date(data[0].created_at).getTime() + 60000 //60000
      }

      // Agregar inmediatamente al estado
      setMensajes(prev => [nuevoMensaje, ...prev])

      // Limpiar formulario
      setTexto('')
      setNombre('')
      setClickPosition(null)
      
      showToast('¡Mensaje publicado correctamente!', 'success')

      // Dispatar evento para sincronizar con otras ventanas
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'wallMessages',
        newValue: localStorage.getItem('wallMessages')
      }))

    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      showToast(`Error al publicar: ${error.message}`, 'error')
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
    console.log('📍 Posición seleccionada:', newPosition)
  }

  const limpiarMensajesExpirados = () => {
    const now = Date.now()
    setMensajes(prev => {
      const activos = prev.filter(msg => msg.expirationTime > now)
      if (activos.length !== prev.length) {
        console.log(`🧹 Limpiados ${prev.length - activos.length} mensajes expirados`)
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
      console.log('🚀 Inicializando WallDigital con persistencia mejorada...')
      
      const connected = await checkConnection()
      
      if (connected && mounted) {
        console.log('✅ Conectado, cargando mensajes...')
        await cargarMensajes()
        
        // Auto-refresh cada 3 segundos para mejor sincronización
        console.log('⏱️ Configurando auto-refresh cada 3 segundos...')
        refreshIntervalRef.current = setInterval(() => {
          if (mounted) {
            cargarMensajes()
          }
        }, 3000)
      }
    }

    init()

    // Limpiar mensajes expirados cada segundo
    const cleanupInterval = setInterval(() => {
      if (mounted) {
        limpiarMensajesExpirados()
      }
    }, 1000)

    // Escuchar cambios en localStorage para sincronización entre ventanas
    const handleStorageChange = (e) => {
      if (e.key === 'wallMessages' && mounted) {
        console.log('🔄 Detectado cambio en otra ventana, recargando mensajes...')
        cargarMensajes()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // También escuchar cambios de visibilidad para recargar cuando la ventana vuelve a ser visible
    const handleVisibilityChange = () => {
      if (!document.hidden && mounted) {
        console.log('👁️ Ventana visible de nuevo, recargando mensajes...')
        cargarMensajes()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      console.log('🛑 Desmontando componente...')
      mounted = false
      clearInterval(cleanupInterval)
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // ========================================
  // RENDER
  // ========================================

  const getButtonText = () => {
    if (!isOnline) return '❌ Sin conexión'
    if (isLoading) return '⏳ Publicando...'
    if (clickPosition && texto.trim()) return '✅ Publicar Mensaje'
    if (clickPosition) return '💬 Escribe tu mensaje'
    return '📍 Haz clic en el muro primero'
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
          fontWeight: '600'
        }}>
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
          🌐 Muro Digital Compartido
        </h1>
        <p style={{ opacity: '0.9', fontSize: '16px' }}>
          Mensajes persistentes • Sincronización automática entre ventanas • Duración: 1 minuto
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

            {/* Mensaje si no hay mensajes */}
            {mensajes.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                backdropFilter: 'blur(10px)'
              }}>
                <p style={{ fontSize: '18px', marginBottom: '8px' }}>
                  {isOnline ? 'No hay mensajes activos' : 'Conectando...'}
                </p>
                <p style={{ fontSize: '14px', opacity: '0.8' }}>
                  {isOnline ? '¡Sé el primero en escribir algo!' : 'Verificando conexión'}
                </p>
              </div>
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
              👤 Tu Nombre:
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

          {/* Botón de recarga manual */}
          <button
            onClick={() => cargarMensajes()}
            disabled={!isOnline || isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#718096',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: isOnline && !isLoading ? 'pointer' : 'not-allowed',
              marginTop: '10px',
              opacity: isOnline && !isLoading ? 1 : 0.5
            }}
          >
            🔄 Actualizar Mensajes
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
                {isOnline ? 'Conectado (Persistente)' : 'Sin conexión'}
              </span>
            </div>
            
            <div style={{
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.5'
            }}>
              <strong>📋 Mejoras implementadas:</strong><br/>
              • Los mensajes persisten al recargar<br/>
              • Sincronización entre ventanas abiertas<br/>
              • Actualización automática cada 3 segundos<br/>
              • Limpieza automática de mensajes expirados
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