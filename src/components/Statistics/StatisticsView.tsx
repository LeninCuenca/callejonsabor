// =====================================================
// VIEWS - Components - Estadisticas de Ventas
// =====================================================

import { ProductSales, Product } from '../../models';
import { TrendingUp, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react';

interface StatisticsViewProps {
  topProducts: ProductSales[];
  leastProducts: ProductSales[];
  products: Product[];
}

export function StatisticsView({ topProducts, leastProducts, products }: StatisticsViewProps) {
  const outOfStockProducts = products.filter(p => p.stock <= 0);
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5);

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h2 className="text-white text-2xl font-bold mb-1">Estadisticas</h2>
        <p className="text-gray-500 text-sm">Analisis de ventas</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h3 className="text-white font-semibold">Top Mas Vendidos</h3>
        </div>

        {topProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay datos aun</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((product, index) => (
              <div key={product.productId} className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500 text-gray-900' :
                  index === 1 ? 'bg-gray-400 text-gray-900' :
                  index === 2 ? 'bg-amber-700 text-white' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{product.productName}</p>
                  <p className="text-gray-500 text-xs">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{product.quantitySold}</p>
                  <p className="text-green-400 text-xs">${product.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-red-400" />
          <h3 className="text-white font-semibold">Menos Vendidos</h3>
        </div>

        {leastProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay datos aun</p>
        ) : (
          <div className="space-y-2">
            {leastProducts.map((product) => (
              <div key={product.productId} className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{product.productName}</p>
                  <p className="text-gray-500 text-xs">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 font-bold">{product.quantitySold}</p>
                  <p className="text-gray-500 text-xs">${product.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(outOfStockProducts.length > 0 || lowStockProducts.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <h3 className="text-white font-semibold">Alertas de Inventario</h3>
          </div>

          <div className="space-y-3">
            {outOfStockProducts.length > 0 && (
              <div className="bg-red-950/50 border border-red-800 rounded-xl p-3">
                <p className="text-red-400 font-semibold text-sm mb-2">Sin Stock ({outOfStockProducts.length})</p>
                <div className="flex flex-wrap gap-2">
                  {outOfStockProducts.map(p => (
                    <span key={p.id} className="bg-red-900/50 text-red-300 text-xs px-2 py-1 rounded">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {lowStockProducts.length > 0 && (
              <div className="bg-orange-950/50 border border-orange-800 rounded-xl p-3">
                <p className="text-orange-400 font-semibold text-sm mb-2">Stock Bajo ({lowStockProducts.length})</p>
                <div className="flex flex-wrap gap-2">
                  {lowStockProducts.map(p => (
                    <span key={p.id} className="bg-orange-900/50 text-orange-300 text-xs px-2 py-1 rounded">
                      {p.name} ({p.stock})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
