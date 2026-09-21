'use client';

import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Barcode,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, paiseToRupees, rupeesToPaise, bpsToPercent } from '@/lib/money';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  price: number; // paise
  costPrice: number; // paise
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number; // bps
  categoryId?: string;
  category?: Category;
}

export default function ProductsStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    categoryId: '',
    priceRupees: '',
    costPriceRupees: '',
    stock: '10',
    minStock: '5',
    unit: 'pcs',
    taxRatePercent: '0',
  });
  const [saving, setSaving] = useState(false);
  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/products/${productToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`"${productToDelete.name}" removed successfully`);
        setProductToDelete(null);
        if (showModal && editingId === productToDelete.id) {
          setShowModal(false);
        }
        fetchData();
      } else {
        toast.error(json.error ?? 'Failed to delete product');
      }
    } catch (err) {
      toast.error('Network error deleting product');
    } finally {
      setDeleting(false);
    }
  };

  const fetchData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/v1/products?pageSize=200').then((r) => r.json()),
        fetch('/api/v1/categories').then((r) => r.json()),
      ]);
      setProducts(pRes.data ?? []);
      setCategories(cRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      barcode: '',
      categoryId: categories[0]?.id || '',
      priceRupees: '',
      costPriceRupees: '',
      stock: '20',
      minStock: '5',
      unit: 'pcs',
      taxRatePercent: '5',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      categoryId: p.categoryId || '',
      priceRupees: String(paiseToRupees(p.price)),
      costPriceRupees: String(paiseToRupees(p.costPrice)),
      stock: String(p.stock),
      minStock: String(p.minStock),
      unit: p.unit,
      taxRatePercent: String((p.taxRate / 100).toFixed(0)),
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    const pricePaise = rupeesToPaise(parseFloat(form.priceRupees) || 0);
    const costPricePaise = rupeesToPaise(parseFloat(form.costPriceRupees) || 0);
    const taxBps = Math.round((parseFloat(form.taxRatePercent) || 0) * 100);

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        barcode: form.barcode.trim() || undefined,
        categoryId: form.categoryId || undefined,
        price: pricePaise,
        costPrice: costPricePaise,
        stock: parseFloat(form.stock) || 0,
        minStock: parseFloat(form.minStock) || 5,
        unit: form.unit.trim() || 'pcs',
        taxRate: taxBps,
      };

      const url = editingId ? `/api/v1/products/${editingId}` : '/api/v1/products';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(editingId ? 'Product updated!' : 'Product added!');
        setShowModal(false);
        fetchData();
      } else {
        toast.error(json.error ?? 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchesCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-stone-800">
              Products &amp; Stock
            </h1>
            {lowStockCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} /> {lowStockCount} low stock
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Manage your shop catalog, stock levels, buying cost &amp; selling prices
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus size={14} /> Add Product
        </button>
      </header>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCat('all')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedCat === 'all'
                ? 'bg-stone-800 text-white'
                : 'bg-panel border border-border-light text-stone-600 hover:bg-stone-100'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                selectedCat === c.id
                  ? 'bg-brand text-white'
                  : 'bg-panel border border-border-light text-stone-600 hover:bg-stone-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search product or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-panel border border-border-light rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand/40 shadow-xs"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">PRODUCT</th>
                <th className="p-3">BARCODE</th>
                <th className="p-3">CATEGORY</th>
                <th className="p-3 text-right">COST PRICE</th>
                <th className="p-3 text-right">SELLING PRICE</th>
                <th className="p-3 text-right">PROFIT MARGIN</th>
                <th className="p-3 text-center">STOCK</th>
                <th className="p-3 text-center">GST %</th>
                <th className="p-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400">
                    Loading inventory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-stone-400">
                    <Package size={32} className="mx-auto text-stone-200 mb-2" />
                    No products found
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  const margin = p.price - p.costPrice;
                  const marginPercent =
                    p.price > 0 ? Math.round((margin / p.price) * 100) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-stone-800 block">{p.name}</span>
                        <span className="text-[10px] text-stone-400 font-mono">Unit: {p.unit}</span>
                      </td>
                      <td className="p-3 font-mono text-stone-500">
                        {p.barcode ? `#${p.barcode}` : '—'}
                      </td>
                      <td className="p-3">
                        <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {p.category?.name ?? 'General'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-stone-500">
                        {formatCurrency(p.costPrice)}
                      </td>
                      <td className="p-3 text-right font-bold text-stone-800">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-emerald-700 font-bold">
                          +{marginPercent}%
                        </span>
                        <span className="text-[9px] text-stone-400 block">
                          +{formatCurrency(margin)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 ${
                            isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isLow && <AlertTriangle size={10} />}
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="p-3 text-center text-stone-500 font-medium">
                        {bpsToPercent(p.taxRate)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="text-stone-400 hover:text-brand p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove Product"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-light pb-3">
              <h3 className="font-display font-bold text-base text-stone-800">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-600 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand"
                  placeholder="e.g. Basmati Rice 5kg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Barcode / SKU</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand font-mono"
                    placeholder="890103001"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.priceRupees}
                    onChange={(e) => setForm({ ...form, priceRupees: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand font-bold text-brand"
                    placeholder="50.00"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 mb-1">
                    Cost / Buying Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPriceRupees}
                    onChange={(e) => setForm({ ...form, costPriceRupees: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand"
                    placeholder="35.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Current Stock</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="ltr">Liter (ltr)</option>
                    <option value="pkt">Packet (pkt)</option>
                    <option value="box">Box (box)</option>
                    <option value="bag">Bag (bag)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 mb-1">GST Rate</label>
                  <select
                    value={form.taxRatePercent}
                    onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })}
                    className="w-full border border-border-light rounded-lg px-3 py-2 bg-white text-xs focus:outline-none focus:border-brand"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const current = products.find((p) => p.id === editingId);
                      if (current) setProductToDelete(current);
                    }}
                    className="border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 font-bold text-xs cursor-pointer transition-colors"
                    title="Remove this product from catalog"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-border-light text-stone-600 hover:bg-stone-50 px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-stone-800">
                  Remove Product?
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  This product will be removed from your active catalog
                </p>
              </div>
            </div>

            <div className="bg-stone-50 border border-border-light rounded-xl p-3 space-y-1 text-xs">
              <div className="font-bold text-stone-800">{productToDelete.name}</div>
              {productToDelete.barcode && (
                <div className="text-[11px] font-mono text-stone-500">
                  Barcode: #{productToDelete.barcode}
                </div>
              )}
              <div className="flex justify-between items-center text-stone-600 pt-1 border-t border-border-light/60">
                <span>Current Stock:</span>
                <span className="font-bold text-stone-800">
                  {productToDelete.stock} {productToDelete.unit}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-stone-400">
              Existing sales history will be preserved, but this item will no longer appear at the billing counter.
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition-colors cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                {deleting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                {deleting ? 'Removing...' : 'Yes, Remove Product'}
              </button>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={deleting}
                className="border border-border-light text-stone-600 hover:bg-stone-50 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
