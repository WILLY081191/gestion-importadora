export interface Vendedor {
  id: string
  nombre: string
  porcentaje_comision: number
  activo: boolean
  created_at: string
}

export interface Cuenta {
  id: string
  nombre: string
  tipo: 'efectivo_bs' | 'banco_bs' | 'qr' | 'caja_usd'
  saldo: number
  moneda: 'BOB' | 'USD'
  activo: boolean
  created_at: string
}

export interface Producto {
  id: string
  sku: string
  nombre: string
  marca: string
  categoria: string
  stock_actual: number
  stock_minimo: number
  costo_promedio_bs: number
  precio_venta_bs: number
  activo: boolean
  created_at: string
}

export interface Importacion {
  id: string
  numero_lote: string
  fecha: string
  tipo_cambio: number
  flete_usd: number
  seguro_usd: number
  dat_porcentaje: number
  despachante_bs: number
  otros_gastos_bs: number
  costo_total_bs: number
  estado: 'pendiente' | 'en_transito' | 'capitalizado'
  notas: string
  created_at: string
  importacion_items?: ImportacionItem[]
}

export interface ImportacionItem {
  id: string
  importacion_id: string
  producto_id: string
  cantidad: number
  costo_unitario_usd: number
  costo_total_usd: number
  costo_unitario_bs_real: number
  created_at: string
  productos?: Producto
}

export interface Venta {
  id: string
  fecha: string
  vendedor_id: string
  cuenta_id: string
  total_bs: number
  costo_total_bs: number
  ganancia_bs: number
  comision_bs: number
  notas: string
  created_at: string
  vendedores?: Vendedor
  cuentas?: Cuenta
  venta_items?: VentaItem[]
}

export interface VentaItem {
  id: string
  venta_id: string
  producto_id: string
  cantidad: number
  precio_unitario_bs: number
  costo_unitario_bs: number
  subtotal_bs: number
  created_at: string
  productos?: Producto
}

export interface CajaMovimiento {
  id: string
  fecha: string
  cuenta_id: string
  tipo: 'ingreso' | 'egreso' | 'transferencia_in' | 'transferencia_out' | 'aporte'
  concepto: string
  monto: number
  referencia_id?: string
  referencia_tipo?: string
  created_at: string
  cuentas?: Cuenta
}

export interface Comision {
  id: string
  venta_id: string
  vendedor_id: string
  monto_bs: number
  estado: 'pendiente' | 'pagado'
  fecha_pago?: string
  created_at: string
  vendedores?: Vendedor
  ventas?: Venta
}

export interface CarritoItem {
  producto: Producto
  cantidad: number
  precio_unitario_bs: number
}
