import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs, formatDateTime } from '../lib/utils'
import type { Cuenta, CajaMovimiento } from '../lib/types'

type FormTipo = 'aporte' | 'egreso' | 'transferencia'

export default function Caja() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editMovimiento, setEditMovimiento] = useState<CajaMovimiento | null>(null)
  const [tipo, setTipo] = useState<FormTipo>('aporte')
  const [form, setForm] = useState({ cuenta_id: '', cuenta_destino_id: '', concepto: '', monto: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [c, m] = await Promise.all([
      supabase.from('cuentas').select('*').eq('activo', true),
      supabase.from('caja_movimientos').select('*, cuentas(nombre, moneda)').order('created_at', { ascending: false }).limit(100)
    ])
    setCuentas(c.data || [])
    setMovimientos(m.data || [])
    if (c.data?.length) setForm(f => ({ ...f, cuenta_id: c.data![0].id }))
    setLoading(false)
  }

  async function registrar() {
    if (!form.cuenta_id || !form.concepto || form.monto === '' || form.monto === 0) return alert('Completa todos los campos')
    if (tipo === 'transferencia' && !form.cuenta_destino_id) return alert('Selecciona cuenta destino')
    setSaving(true)
    try {
      const cuenta = cuentas.find(c => c.id === form.cuenta_id)!
      const montoNum = Number(form.monto)
      if (tipo === 'aporte') {
        await supabase.from('caja_movimientos').insert({
          cuenta_id: form.cuenta_id, tipo: 'aporte', concepto: form.concepto, monto: montoNum
        })
        await supabase.from('cuentas').update({ saldo: cuenta.saldo + montoNum }).eq('id', form.cuenta_id)
      } else if (tipo === 'egreso') {
        await supabase.from('caja_movimientos').insert({
          cuenta_id: form.cuenta_id, tipo: 'egreso', concepto: form.concepto, monto: montoNum
        })
        await supabase.from('cuentas').update({ saldo: cuenta.saldo - montoNum }).eq('id', form.cuenta_id)
      } else {
        const destino = cuentas.find(c => c.id === form.cuenta_destino_id)!
        await supabase.from('caja_movimientos').insert([
          { cuenta_id: form.cuenta_id, tipo: 'transferencia_out', concepto: `Transferencia → ${destino.nombre}`, monto: montoNum },
          { cuenta_id: form.cuenta_destino_id, tipo: 'transferencia_in', concepto: `Transferencia ← ${cuenta.nombre}`, monto: montoNum }
        ])
        await supabase.from('cuentas').update({ saldo: cuenta.saldo - montoNum }).eq('id', form.cuenta_id)
        await supabase.from('cuentas').update({ saldo: destino.saldo + montoNum }).eq('id', form.cuenta_destino_id)
      }
      alert('✅ Registrado correctamente')
      setModal(false)
      setForm(f => ({ ...f, concepto: '', monto: '' }))
      load()
    } catch (e: any) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  function abrirEditar(movimiento: CajaMovimiento) {
    setEditMovimiento(movimiento)
    setForm({
      cuenta_id: movimiento.cuenta_id,
      cuenta_destino_id: '',
      concepto: movimiento.concepto,
      monto: movimiento.monto.toString()
    })
    setEditModal(true)
  }

  async function guardarEdicion() {
    if (!form.cuenta_id || !form.concepto || form.monto === '' || form.monto === 0) return alert('Completa todos los campos')
    if (!editMovimiento) return alert('No hay movimiento seleccionado')

    setSaving(true)
    try {
      const montoAnterior = editMovimiento.monto
      const tipoMov = editMovimiento.tipo
      const cuentaAnterior = cuentas.find(c => c.id === editMovimiento.cuenta_id)!
      const cuentaNueva = cuentas.find(c => c.id === form.cuenta_id)!
      const montoNuevo = Number(form.monto)

      const esEntradaAnterior = ['ingreso', 'aporte', 'transferencia_in'].includes(tipoMov)
      const saldoRevertido = esEntradaAnterior
        ? cuentaAnterior.saldo - montoAnterior
        : cuentaAnterior.saldo + montoAnterior

      const { error } = await supabase
        .from('caja_movimientos')
        .update({
          cuenta_id: form.cuenta_id,
          concepto: form.concepto,
          monto: montoNuevo
        })
        .eq('id', editMovimiento.id)

      if (error) throw error

      if (cuentaAnterior.id === cuentaNueva.id) {
        const esEntrada = ['ingreso', 'aporte', 'transferencia_in'].includes(tipoMov)
        const saldoFinal = esEntrada
          ? saldoRevertido + montoNuevo
          : saldoRevertido - montoNuevo
        await supabase.from('cuentas').update({ saldo: saldoFinal }).eq('id', cuentaNueva.id)
      } else {
        await supabase.from('cuentas').update({ saldo: saldoRevertido }).eq('id', cuentaAnterior.id)
        const esEntrada = ['ingreso', 'aporte', 'transferencia_in'].includes(tipoMov)
        const saldoNuevo = esEntrada
          ? cuentaNueva.saldo + montoNuevo
          : cuentaNueva.saldo - montoNuevo
        await supabase.from('cuentas').update({ saldo: saldoNuevo }).eq('id', cuentaNueva.id)
      }

      alert('✅ Actualizado correctamente')
      setEditModal(false)
      setEditMovimiento(null)
      setForm(f => ({ ...f, concepto: '', monto: '' }))
      load()
    } catch (e: any) {
      alert('Error al actualizar: ' + e.message)
    }
    setSaving(false)
  }

  async function handleEliminar(movimiento: CajaMovimiento) {
    if (!confirm('¿Estás seguro de eliminar este movimiento?')) return

    try {
      const cuenta = cuentas.find(c => c.id === movimiento.cuenta_id)
      if (cuenta) {
        const esEntrada = ['ingreso', 'aporte', 'transferencia_in'].includes(movimiento.tipo)
        const saldoRevertido = esEntrada
          ? cuenta.saldo - movimiento.monto
          : cuenta.saldo + movimiento.monto
        await supabase.from('cuentas').update({ saldo: saldoRevertido }).eq('id', cuenta.id)
      }

      const { error } = await supabase
        .from('caja_movimientos')
        .delete()
        .eq('id', movimiento.id)

      if (error) throw error

      load()
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  const patrimonioBOB = cuentas.filter(c => c.moneda === 'BOB').reduce((s, c) => s + c.saldo, 0)
  const patrimonioUSD = cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.saldo, 0)

  const tipoLabel: Record<string, { label: string; color: string }> = {
    ingreso: { label: 'Venta', color: 'text-green-600' },
    egreso: { label: 'Gasto', color: 'text-red-500' },
    aporte: { label: 'Aporte', color: 'text-blue-600' },
    transferencia_in: { label: 'Entrada', color: 'text-teal-600' },
    transferencia_out: { label: 'Salida', color: 'text-orange-500' },
  }

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja y Capital</h1>
          <p className="text-sm text-gray-500 mt-1">Total BOB: <span className="font-semibold text-blue-700">{formatBs(patrimonioBOB)}</span>
            {patrimonioUSD > 0 && <span className="ml-3 text-yellow-700 font-semibold">+ $ {patrimonioUSD.toFixed(2)} USD</span>}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ Nuevo Movimiento</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cuentas.map(c => {
          const iconos: Record<string, string> = { efectivo_bs: '💵', banco_bs: '🏦', qr: '📱', caja_usd: '💲' }
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{iconos[c.tipo]}</span>
                <p className="text-xs text-gray-500 font-medium">{c.nombre}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {c.moneda === 'USD' ? `$${c.saldo.toFixed(2)}` : formatBs(c.saldo)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Historial de Movimientos</h2>
          <span className="text-xs text-gray-400">{movimientos.length} movimientos</span>
        </div>
        <div className="overflow-auto max-h-[50vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Fecha</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Cuenta</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Concepto</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Monto</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movimientos.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-12">Sin movimientos</td></tr>}
              {movimientos.map(m => {
                const info = tipoLabel[m.tipo] || { label: m.tipo, color: 'text-gray-600' }
                const esEntrada = ['ingreso', 'aporte', 'transferencia_in'].includes(m.tipo)
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(m.fecha)}</td>
                    <td className="px-4 py-3 text-gray-700">{(m as any).cuentas?.nombre}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium ${info.color}`}>{info.label}</span></td>
                    <td className="px-4 py-3 text-gray-700">{m.concepto}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${esEntrada ? 'text-green-600' : 'text-red-500'}`}>
                      {esEntrada ? '+' : '-'}{formatBs(m.monto)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirEditar(m)}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleEliminar(m)}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Movimiento</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex bg-gray-100 rounded-lg p-1 text-sm gap-1">
                {([['aporte', '💰 Aporte'], ['egreso', '💸 Gasto'], ['transferencia', '🔄 Transferencia']] as [FormTipo, string][]).map(([t, l]) => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`flex-1 py-2 rounded-md font-medium transition ${tipo === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{l}</button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{tipo === 'transferencia' ? 'Cuenta Origen' : 'Cuenta'}</label>
                <select value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.moneda === 'USD' ? `$${c.saldo.toFixed(2)}` : formatBs(c.saldo)}</option>)}
                </select>
              </div>

              {tipo === 'transferencia' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Cuenta Destino</label>
                  <select value={form.cuenta_destino_id} onChange={e => setForm({ ...form, cuenta_destino_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar...</option>
                    {cuentas.filter(c => c.id !== form.cuenta_id).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Concepto</label>
                <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Ej: Pago proveedor, capital inicial..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Monto (Bs)</label>
                <input 
                  type="number" 
                  step="any"
                  value={form.monto} 
                  onChange={e => setForm({ ...form, monto: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={registrar} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && editMovimiento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Editar Movimiento</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Cuenta</label>
                <select value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.moneda === 'USD' ? `$${c.saldo.toFixed(2)}` : formatBs(c.saldo)}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Concepto</label>
                <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Monto (Bs)</label>
                <input 
                  type="number" 
                  step="any"
                  value={form.monto} 
                  onChange={e => setForm({ ...form, monto: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setEditModal(false); setEditMovimiento(null) }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={guardarEdicion} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}