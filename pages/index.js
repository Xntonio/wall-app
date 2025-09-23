import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Mi Wall App</h1>
      <p>Bienvenido a la aplicación de notas</p>
      <Link href="/add">
        <button style={{ 
          padding: '10px 20px', 
          fontSize: '16px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}>
          Agregar Nota
        </button>
      </Link>
    </div>
  )
}