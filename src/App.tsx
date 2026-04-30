import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Ventas from './pages/Ventas'
import Importaciones from './pages/Importaciones'
import Caja from './pages/Caja'
import Comisiones from './pages/Comisiones'
import Reportes from './pages/Reportes'

type Page = 'dashboard' | 'caja' | 'ventas' | 'importaciones' | 'inventario' | 'comisiones' | 'reportes'

const nav: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'caja', label: 'Caja y Capital', icon: '💰' },
  { id: 'ventas', label: 'Ventas', icon: '🛒' },
  { id: 'importaciones', label: 'Importaciones', icon: '📦' },
  { id: 'inventario', label: 'Inventario', icon: '📋' },
  { id: 'comisiones', label: 'Comisiones', icon: '💵' },
  { id: 'reportes', label: 'Reportes', icon: '📈' },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard />,
    caja: <Caja />,
    ventas: <Ventas />,
    importaciones: <Importaciones />,
    inventario: <Inventario />,
    comisiones: <Comisiones />,
    reportes: <Reportes />,
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-[#0f172a] flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">G</div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Gestión Pro</p>
              <p className="text-blue-300 text-xs">Importadora</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm font-medium ${
                page === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-slate-500 text-xs text-center">v1.0 · Sistema de Gestión</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition">
            <div className="space-y-1.5">
              <div className="w-5 h-0.5 bg-gray-700" />
              <div className="w-5 h-0.5 bg-gray-700" />
              <div className="w-5 h-0.5 bg-gray-700" />
            </div>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">{nav.find(n => n.id === page)?.icon}</span>
            <h1 className="font-semibold text-gray-800">{nav.find(n => n.id === page)?.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500 hidden sm:block">Conectado a Supabase</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {pages[page]}
        </main>
      </div>
    </div>
  )
}
