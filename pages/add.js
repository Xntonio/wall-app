import { useState } from 'react'
import supabase from '../lib/supabaseClient'

export default function AddNote() {
  const [nombre, setNombre] = useState('')
  const [texto, setNota] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('⏳ Guardando...')

    try {
      // Debug: verificar la conexión
      console.log('Intentando insertar:', { nombre, texto })
      
      const { data, error } = await supabase
        .from('Notes')
        .insert([{ nombre, texto }])
        .select()

      if (error) {
        console.error('Error completo:', error)
        setStatus(`❌ Error: ${error.message}`)
      } else {
        console.log('Datos insertados:', data)
        setStatus('✅ Nota guardada')
        setNombre('')
        setNota('')
      }
    } catch (err) {
      console.error('Error de conexión:', err)
      setStatus('❌ Error de conexión')
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Agregar Nota</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <br /><br />
        <textarea
          placeholder="Texto"
          value={texto}
          onChange={(e) => setNota(e.target.value)}
          required
          rows="4"
          style={{ width: '300px' }}
        />
        <br /><br />
        <button type="submit">Guardar</button>
      </form>
      <p>{status}</p>
    </div>
  )
}