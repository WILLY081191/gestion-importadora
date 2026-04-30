-- ============================================================
-- SISTEMA DE GESTIÓN - IMPORTADORA/DISTRIBUIDORA
-- Ejecutar este SQL en Supabase SQL Editor
-- ============================================================

-- 1. VENDEDORES
CREATE TABLE IF NOT EXISTS vendedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  porcentaje_comision NUMERIC(5,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CUENTAS (Efectivo Bs, Banco Bs, QR, Caja USD)
CREATE TABLE IF NOT EXISTS cuentas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('efectivo_bs','banco_bs','qr','caja_usd')),
  saldo NUMERIC(14,2) DEFAULT 0,
  moneda TEXT DEFAULT 'BOB' CHECK (moneda IN ('BOB','USD')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  marca TEXT,
  categoria TEXT,
  stock_actual NUMERIC(10,2) DEFAULT 0,
  stock_minimo NUMERIC(10,2) DEFAULT 0,
  costo_promedio_bs NUMERIC(14,4) DEFAULT 0,
  precio_venta_bs NUMERIC(14,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. IMPORTACIONES (lotes)
CREATE TABLE IF NOT EXISTS importaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_lote TEXT NOT NULL,
  fecha DATE NOT NULL,
  tipo_cambio NUMERIC(8,4) NOT NULL,
  flete_usd NUMERIC(14,2) DEFAULT 0,
  seguro_usd NUMERIC(14,2) DEFAULT 0,
  dat_porcentaje NUMERIC(5,2) DEFAULT 0,
  despachante_bs NUMERIC(14,2) DEFAULT 0,
  otros_gastos_bs NUMERIC(14,2) DEFAULT 0,
  costo_total_bs NUMERIC(14,2) DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_transito','capitalizado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. IMPORTACION_ITEMS (detalle de cada lote)
CREATE TABLE IF NOT EXISTS importacion_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  importacion_id UUID REFERENCES importaciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  costo_unitario_usd NUMERIC(14,4) NOT NULL,
  costo_total_usd NUMERIC(14,4) GENERATED ALWAYS AS (cantidad * costo_unitario_usd) STORED,
  costo_unitario_bs_real NUMERIC(14,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT now(),
  vendedor_id UUID REFERENCES vendedores(id),
  cuenta_id UUID REFERENCES cuentas(id),
  total_bs NUMERIC(14,2) NOT NULL,
  costo_total_bs NUMERIC(14,2) DEFAULT 0,
  ganancia_bs NUMERIC(14,2) GENERATED ALWAYS AS (total_bs - costo_total_bs) STORED,
  comision_bs NUMERIC(14,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. VENTA_ITEMS (detalle de cada venta)
CREATE TABLE IF NOT EXISTS venta_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario_bs NUMERIC(14,2) NOT NULL,
  costo_unitario_bs NUMERIC(14,4) DEFAULT 0,
  subtotal_bs NUMERIC(14,2) GENERATED ALWAYS AS (cantidad * precio_unitario_bs) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CAJA_MOVIMIENTOS
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT now(),
  cuenta_id UUID REFERENCES cuentas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso','transferencia_in','transferencia_out','aporte')),
  concepto TEXT NOT NULL,
  monto NUMERIC(14,2) NOT NULL,
  referencia_id UUID,
  referencia_tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. COMISIONES
CREATE TABLE IF NOT EXISTS comisiones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id UUID REFERENCES ventas(id),
  vendedor_id UUID REFERENCES vendedores(id),
  monto_bs NUMERIC(14,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado')),
  fecha_pago TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Cuentas base
INSERT INTO cuentas (nombre, tipo, moneda, saldo) VALUES
  ('Efectivo Bs', 'efectivo_bs', 'BOB', 0),
  ('Banco Bs', 'banco_bs', 'BOB', 0),
  ('QR / Billetera Digital', 'qr', 'BOB', 0),
  ('Caja USD', 'caja_usd', 'USD', 0)
ON CONFLICT DO NOTHING;

-- Vendedor base (sin comisión)
INSERT INTO vendedores (nombre, porcentaje_comision) VALUES
  ('Venta Directa', 0),
  ('Vendedor Ejemplo', 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DISABLE RLS (para desarrollo - habilitar en producción)
-- ============================================================
ALTER TABLE vendedores DISABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas DISABLE ROW LEVEL SECURITY;
ALTER TABLE productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE importaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE importacion_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE caja_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones DISABLE ROW LEVEL SECURITY;
