# Callejón del Sabor — POS (Web / Android)

Punto de venta para el restaurante **Callejón del Sabor**.
Aplicación web hecha con **React + Vite + TypeScript + Tailwind**, empaquetada como app
Android con **Capacitor**, y con **Firebase (Firestore + Storage)** como base de datos.

> La misma aplicación también existe en Flutter en la carpeta hermana `../flutter/callejodelsabor/`.

## Requisitos

- Node.js 18+
- Para el APK: Android Studio / SDK + JDK 17

## Puesta en marcha

```bash
npm install          # dependencias
cp .env.example .env # y rellenar los valores de Firebase
npm run dev          # desarrollo en http://localhost:5173
```

Si no tienes el `.env`, puedes generarlo respondiendo un asistente:

```bash
npm run setup:env
```

## APK de Android

```bash
npm run build:apk
```

Eso compila la web (`dist/`), la sincroniza con el proyecto Android (`cap sync`)
y genera el APK de depuración en `android/app/build/outputs/apk/debug/`.

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run seed:firestore` | Limpia y siembra datos de prueba (productos, un pedido, etc.) |
| `npm run emulators:start` | Levanta el emulador local de Firestore |
| `node scripts/list_firestore.cjs` | Lista colecciones del emulador |
| `node scripts/add_plato_desechable.cjs` | Agrega el producto "Plato Desechable" |

`seed:firestore` necesita el JSON de *service account* de Firebase:
pon su ruta en `SERVICE_ACCOUNT_PATH` dentro de `.env`.

## Modelo de datos (Firestore)

- **products**: `name`, `price`, `category`, `requires_packaging`, `stock`
- **orders**: `order_type` (`dine_in` | `takeaway`), `table_number`, `status`
  (`active` | `completed` | `cancelled`), `subtotal`, `packaging_fee`, `total`,
  `amount_paid`, `balance`, `created_at`, `closed_at`
- **order_items**: `order_id`, `product_id`, `product_name`, `category`,
  `quantity`, `unit_price`, `packaging_surcharge`, `item_total`, `is_takeaway`, `paid`
- **payments**: pagos parciales/total de un pedido (método, monto, foto de comprobante)

## Pestañas de la app

POS · Pedidos (activos) · Historial · Caja · Estadísticas · Inventario
