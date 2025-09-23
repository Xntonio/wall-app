import { useState, useEffect } from 'react'
import supabase from '../lib/supabaseClient'

export default function AddNote() {
  const [nombre, setNombre] = useState('')
  const [texto, setNota] = useState('')
  const [status, setStatus] = useState('')
  const [notas, setNotas] = useState([]) // Estado para guardar las notas

  // Función para cargar las notas desde la BD
  const cargarNotas = async () => {
    const { data, error } = await supabase
      .from('Notes')
      .select('*')
      .order('id', { ascending: false }) // las más nuevas primero

    if (error) {
      console.error('Error al leer notas:', error)
      setStatus(`❌ Error al cargar notas: ${error.message}`)
    } else {
      setNotas(data)
    }
  }

  // Cargar notas al inicio
  useEffect(() => {
    cargarNotas()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('⏳ Guardando...')

    try {
      const { data, error } = await supabase
        .from('Notes')
        .insert([{ nombre, texto }])
        .select()

      if (error) {
        console.error('Error completo:', error)
        setStatus(`❌ Error: ${error.message}`)
      } else {
        setStatus('✅ Nota guardada')
        setNombre('')
        setNota('')
        cargarNotas() // recargar notas después de guardar
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

      <h2>Notas:</h2>
      <ul>
        {notas.map((n) => (
          <li key={n.id}>
            <strong>{n.nombre}</strong>: {n.texto}
          </li>
        ))}
      </ul>
    </div>
  )
}
