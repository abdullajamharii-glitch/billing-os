"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Package,
  Plus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  Wrench,
  RotateCcw,
  Trash2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  IndianRupee,
  ShoppingCart,
  BarChart3,
  ChefHat,
  Utensils,
  Layers,
  Sparkles,
  CheckCircle2,
  Info,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, paiseToRupees, rupeesToPaise } from "@/lib/money";

interface Product {
  id: string;
  name: string;
  barcode?: string;
  unit: string;
  stock: number;
  minStock: number;
  costPrice: number;
  price: number;
  categoryId?: string;
  category?: { name: string; color?: string };
}

interface StockEntry {
  id: string;
  type: string;
  qty: number;
  balanceAfter: number;
  note?: string;
  costPricePaise: number;
  supplierName?: string;
  referenceNo?: string;
  createdAt: string;
  product: { id: string; name: string; barcode?: string; unit: string; stock: number };
  createdBy?: { name: string };
}

interface RecipeItemDetail {
  id?: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
    costPrice: number;
    stock: number;
  };
}

interface RecipeGroup {
  product: {
    id: string;
    name: string;
    price: number;
    costPrice: number;
    unit: string;
    stock: number;
    category?: { name: string; color?: string };
  };
  items: RecipeItemDetail[];
  totalCostPaise: number;
}

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode; sign: string }> = {
  PURCHASE: { label: "Purchase", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <TrendingUp size={11} />, sign: "+" },
  ADJUSTMENT: { label: "Adjustment", color: "text-blue-700 bg-blue-50 border-blue-200", icon: <Wrench size={11} />, sign: "±" },
  SALE_DEDUCT: { label: "Sale", color: "text-orange-700 bg-orange-50 border-orange-200", icon: <ShoppingCart size={11} />, sign: "-" },
  RETURN: { label: "Return", color: "text-purple-700 bg-purple-50 border-purple-200", icon: <RotateCcw size={11} />, sign: "+" },
  DAMAGE: { label: "Damage", color: "text-red-700 bg-red-50 border-red-200", icon: <Trash2 size={11} />, sign: "-" },
  OPENING: { label: "Opening", color: "text-stone-700 bg-stone-50 border-stone-300", icon: <Warehouse size={11} />, sign: "+" },
};

const ENTRY_TYPES = ["PURCHASE", "ADJUSTMENT", "RETURN", "DAMAGE", "OPENING"];

export default function InventoryPage() {
  // Tabs: "ledger" | "recipes"
  const [activeTab, setActiveTab] = useState<"ledger" | "recipes">("ledger");

  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);

  // Filters
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterProductId, setFilterProductId] = useState("");

  // Stock-in form modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    type: "PURCHASE" as string,
    qty: "",
    note: "",
    costPriceRupees: "",
    supplierName: "",
    referenceNo: "",
  });
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------
  // RECIPES & BOM STATE
  // -------------------------------------------------------------
  const [recipes, setRecipes] = useState<RecipeGroup[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState("all");
  const [recipeConfigFilter, setRecipeConfigFilter] = useState<"all" | "configured" | "unconfigured">("all");

  // Recipe Editor Modal
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedMenuProduct, setSelectedMenuProduct] = useState<Product | null>(null);
  const [editingItems, setEditingItems] = useState<
    Array<{ ingredientId: string; quantity: number; unit: string; notes?: string }>
  >([]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Fetch all products
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/products?pageSize=200").then((r) => r.json());
      setProducts(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stock entries
  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(filterProductId ? { productId: filterProductId } : {}),
        ...(filterType ? { type: filterType } : {}),
      });
      const res = await fetch(`/api/v1/inventory?${params}`).then((r) => r.json());
      setEntries(res.data ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setEntriesLoading(false);
    }
  }, [page, filterProductId, filterType]);

  // Fetch recipes
  const fetchRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const res = await fetch("/api/v1/recipes").then((r) => r.json());
      if (res.success) {
        setRecipes(res.data ?? []);
      }
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (activeTab === "ledger") {
      fetchEntries();
    } else if (activeTab === "recipes") {
      fetchRecipes();
    }
  }, [activeTab, fetchEntries, fetchRecipes]);

  // Stock KPIs
  const totalSKUs = products.length;
  const outOfStock = products.filter((p) => p.stock <= 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);

  // Raw materials (items in Raw Materials & Kitchen Stock category, or with 0 price)
  const rawIngredients = products.filter(
    (p) =>
      p.category?.name?.toLowerCase().includes("raw material") ||
      p.category?.name?.toLowerCase().includes("kitchen stock") ||
      p.price === 0
  );

  // Available ingredients for recipe dropdown (default to raw materials, fallback to all)
  const ingredientChoices = rawIngredients.length > 0 ? rawIngredients : products;

  // Recipe map for fast lookup
  const recipeMap = new Map<string, RecipeGroup>();
  for (const r of recipes) {
    recipeMap.set(r.product.id, r);
  }

  // Menu items (items with a positive selling price, or not in raw materials)
  const menuItems = products.filter(
    (p) =>
      !p.category?.name?.toLowerCase().includes("raw material") &&
      !p.category?.name?.toLowerCase().includes("kitchen stock")
  );

  // Unique categories for recipes filter
  const categories = Array.from(
    new Set(menuItems.map((p) => p.category?.name).filter(Boolean) as string[])
  );

  // Filtered menu items for recipe view
  const filteredMenuItems = menuItems.filter((p) => {
    const matchesSearch =
      !recipeSearch ||
      p.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(recipeSearch.toLowerCase()));

    const matchesCategory =
      recipeCategoryFilter === "all" || p.category?.name === recipeCategoryFilter;

    const hasRecipe = recipeMap.has(p.id);
    const matchesConfig =
      recipeConfigFilter === "all" ||
      (recipeConfigFilter === "configured" && hasRecipe) ||
      (recipeConfigFilter === "unconfigured" && !hasRecipe);

    return matchesSearch && matchesCategory && matchesConfig;
  });

  // Handle Save Stock Entry
  const handleSaveStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId) {
      toast.error("Select a product");
      return;
    }
    if (!form.qty || isNaN(parseFloat(form.qty)) || parseFloat(form.qty) === 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    setSaving(true);
    try {
      const qty = parseFloat(form.qty);
      const payload = {
        productId: form.productId,
        type: form.type,
        qty: ["DAMAGE", "ADJUSTMENT"].includes(form.type) ? qty : Math.abs(qty),
        note: form.note.trim() || undefined,
        costPricePaise: form.costPriceRupees ? rupeesToPaise(parseFloat(form.costPriceRupees)) : 0,
        supplierName: form.supplierName.trim() || undefined,
        referenceNo: form.referenceNo.trim() || undefined,
      };

      const res = await fetch("/api/v1/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to create stock entry");
        return;
      }

      toast.success("Stock entry recorded successfully!");
      setShowForm(false);
      setForm({
        productId: "",
        type: "PURCHASE",
        qty: "",
        note: "",
        costPriceRupees: "",
        supplierName: "",
        referenceNo: "",
      });
      fetchEntries();
      fetchProducts();
    } catch {
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  // Open Recipe Modal for a menu product
  const handleOpenRecipeModal = (prod: Product) => {
    setSelectedMenuProduct(prod);
    const existing = recipeMap.get(prod.id);
    if (existing && existing.items.length > 0) {
      setEditingItems(
        existing.items.map((it) => ({
          ingredientId: it.ingredientId,
          quantity: it.quantity,
          unit: it.unit,
          notes: it.notes || "",
        }))
      );
    } else {
      const defaultIng = ingredientChoices[0];
      setEditingItems([
        {
          ingredientId: defaultIng?.id || "",
          quantity: 1,
          unit: defaultIng?.unit || "pcs",
          notes: "",
        },
      ]);
    }
    setShowRecipeModal(true);
  };

  // Add ingredient row in recipe modal
  const handleAddIngredientRow = () => {
    const defaultIng = ingredientChoices[0];
    setEditingItems((prev) => [
      ...prev,
      {
        ingredientId: defaultIng?.id || "",
        quantity: 1,
        unit: defaultIng?.unit || "pcs",
        notes: "",
      },
    ]);
  };

  // Remove ingredient row
  const handleRemoveIngredientRow = (index: number) => {
    setEditingItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update ingredient row field
  const handleUpdateIngredientRow = (
    index: number,
    field: "ingredientId" | "quantity" | "unit" | "notes",
    val: any
  ) => {
    setEditingItems((prev) => {
      const next = [...prev];
      if (field === "ingredientId") {
        const found = products.find((p) => p.id === val);
        next[index] = {
          ...next[index],
          ingredientId: val,
          unit: found?.unit || next[index].unit,
        };
      } else {
        next[index] = { ...next[index], [field]: val };
      }
      return next;
    });
  };

  // Calculate live estimated food cost in Recipe Editor
  const currentModalCostPaise = editingItems.reduce((acc, row) => {
    const ing = products.find((p) => p.id === row.ingredientId);
    if (!ing || !row.quantity || row.quantity <= 0) return acc;
    return acc + Math.round((ing.costPrice || 0) * row.quantity);
  }, 0);

  // Save recipe
  const handleSaveRecipe = async () => {
    if (!selectedMenuProduct) return;

    const validItems = editingItems.filter(
      (it) => it.ingredientId && it.quantity && it.quantity > 0
    );

    if (validItems.length === 0) {
      toast.error("Please add at least one valid ingredient with quantity > 0");
      return;
    }

    setSavingRecipe(true);
    try {
      const res = await fetch("/api/v1/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedMenuProduct.id,
          items: validItems.map((it) => ({
            ingredientId: it.ingredientId,
            quantity: Number(it.quantity),
            unit: it.unit || "pcs",
            notes: it.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to save recipe");
        return;
      }

      toast.success(`BOM Recipe saved for "${selectedMenuProduct.name}"!`);
      setShowRecipeModal(false);
      fetchRecipes();
      fetchProducts();
    } catch {
      toast.error("Failed to save recipe");
    } finally {
      setSavingRecipe(false);
    }
  };

  // Delete recipe
  const handleDeleteRecipe = async () => {
    if (!selectedMenuProduct) return;
    if (!confirm(`Are you sure you want to delete the recipe for "${selectedMenuProduct.name}"?`)) {
      return;
    }

    setSavingRecipe(true);
    try {
      const res = await fetch(`/api/v1/recipes?productId=${selectedMenuProduct.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to delete recipe");
        return;
      }

      toast.success(`Recipe deleted for "${selectedMenuProduct.name}"`);
      setShowRecipeModal(false);
      fetchRecipes();
    } catch {
      toast.error("Failed to delete recipe");
    } finally {
      setSavingRecipe(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse size={22} className="text-brand" />
            <h1 className="text-2xl font-display font-bold text-stone-800">Inventory & BOM</h1>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Track stock movements, raw materials, purchase entries & automatic recipe consumption
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={14} /> Add Stock / Purchase
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-border-light gap-2">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "ledger"
              ? "border-brand text-brand"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Warehouse size={14} /> Stock Movements & Ledger
        </button>
        <button
          onClick={() => setActiveTab("recipes")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "recipes"
              ? "border-brand text-brand"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <ChefHat size={14} /> Recipes (BOM)
          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
            <Sparkles size={10} /> Auto-Deduct on Sale
          </span>
        </button>
      </div>

      {/* =============================================================
          TAB 1: STOCK MOVEMENTS & LEDGER
          ============================================================= */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-panel border border-border-light rounded-xl p-4 shadow-xs">
              <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wide mb-1">Total SKUs</div>
              <div className="text-2xl font-display font-extrabold text-stone-800">{totalSKUs}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">Active products</div>
            </div>
            <div className="bg-panel border border-border-light rounded-xl p-4 shadow-xs">
              <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wide mb-1">Stock Value</div>
              <div className="text-xl font-display font-extrabold text-emerald-700">{formatCurrency(totalStockValue)}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">At cost price</div>
            </div>
            <div className="bg-panel border border-amber-200 rounded-xl p-4 shadow-xs">
              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
                <AlertTriangle size={10} /> Low Stock
              </div>
              <div className="text-2xl font-display font-extrabold text-amber-700">{lowStock}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">Below minimum level</div>
            </div>
            <div className="bg-panel border border-red-200 rounded-xl p-4 shadow-xs">
              <div className="text-[10px] text-red-600 font-bold uppercase tracking-wide mb-1">Out of Stock</div>
              <div className="text-2xl font-display font-extrabold text-red-600">{outOfStock}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">Zero stock products</div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {(lowStock > 0 || outOfStock > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-800">Low Stock Alert — Restock Required</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {products
                  .filter((p) => p.stock <= p.minStock)
                  .slice(0, 20)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setShowForm(true);
                        setForm((f) => ({ ...f, productId: p.id, type: "PURCHASE" }));
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                        p.stock <= 0
                          ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      <Package size={10} />
                      <span>{p.name}</span>
                      <span className="font-mono font-bold">
                        {p.stock <= 0 ? "OUT" : `${p.stock} ${p.unit}`}
                      </span>
                      <Plus size={10} className="text-emerald-600" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Stock Ledger Table */}
          <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
            {/* Ledger Filters */}
            <div className="p-4 border-b border-border-light flex flex-wrap gap-3 items-center justify-between bg-stone-50/60">
              <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <BarChart3 size={15} className="text-stone-500" /> Stock Movement Ledger
                <span className="text-xs font-normal text-stone-400 font-mono">({total} total records)</span>
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter by Type */}
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                  className="text-xs border border-border-light rounded-lg px-2.5 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-brand/40"
                >
                  <option value="">All Entry Types</option>
                  {ENTRY_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>
                  ))}
                </select>

                {/* Filter by Product */}
                <div className="relative">
                  <input
                    type="text"
                    value={filterProduct}
                    onChange={(e) => {
                      setFilterProduct(e.target.value);
                      if (!e.target.value) setFilterProductId("");
                    }}
                    placeholder="Filter product..."
                    className="text-xs border border-border-light rounded-lg pl-7 pr-7 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-brand/40 w-44"
                  />
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  {filterProduct && (
                    <button
                      onClick={() => { setFilterProduct(""); setFilterProductId(""); setPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  )}
                  {filterProduct && !filterProductId && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-white border border-border-light rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {products
                        .filter((p) => p.name.toLowerCase().includes(filterProduct.toLowerCase()))
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFilterProduct(p.name);
                              setFilterProductId(p.id);
                              setPage(1);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 border-b border-border-light last:border-0 cursor-pointer flex justify-between"
                          >
                            <span>{p.name}</span>
                            <span className="text-stone-400 font-mono">{p.stock} {p.unit}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {(filterType || filterProductId) && (
                  <button
                    onClick={() => { setFilterType(""); setFilterProduct(""); setFilterProductId(""); setPage(1); }}
                    className="text-xs text-stone-400 hover:text-stone-700 px-2 py-1 rounded cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-light bg-stone-50/40 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Qty Change</th>
                    <th className="py-2.5 px-4 text-right">Balance After</th>
                    <th className="py-2.5 px-4">Supplier / Reference</th>
                    <th className="py-2.5 px-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {entriesLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        <div className="inline-block w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin mb-2" />
                        <div>Loading ledger entries...</div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        <Package size={28} className="mx-auto mb-2 text-stone-300" />
                        <p className="font-semibold">No stock movements found</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          Use &quot;Add Stock / Purchase&quot; above or sell items at POS to generate ledger entries
                        </p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const meta = TYPE_META[entry.type] ?? {
                        label: entry.type,
                        color: "text-stone-700 bg-stone-100",
                        icon: null,
                        sign: "",
                      };
                      const isPositive = entry.qty > 0;
                      const dateObj = new Date(entry.createdAt);

                      return (
                        <tr key={entry.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-stone-500 whitespace-nowrap">
                            <div>{dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                            <div className="text-[10px] text-stone-400">{dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>

                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-stone-800">{entry.product.name}</div>
                            {entry.product.barcode && (
                              <div className="text-[10px] font-mono text-stone-400">{entry.product.barcode}</div>
                            )}
                          </td>

                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${meta.color}`}>
                              {meta.icon}
                              {meta.label}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            <span className={isPositive ? "text-emerald-700" : "text-stone-700"}>
                              {isPositive ? `+${entry.qty}` : entry.qty} {entry.product.unit}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-600">
                            {entry.balanceAfter} {entry.product.unit}
                          </td>

                          <td className="py-2.5 px-4 text-stone-600">
                            {entry.supplierName ? (
                              <div>
                                <div className="font-semibold text-stone-800">{entry.supplierName}</div>
                                {entry.referenceNo && (
                                  <div className="text-[10px] font-mono text-stone-400">Ref: {entry.referenceNo}</div>
                                )}
                              </div>
                            ) : entry.referenceNo ? (
                              <span className="font-mono text-[10px] text-stone-500">Ref: {entry.referenceNo}</span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-4 text-stone-500 max-w-xs truncate">
                            {entry.note ? (
                              <span
                                className={
                                  entry.note.startsWith("BOM:")
                                    ? "text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]"
                                    : ""
                                }
                              >
                                {entry.note}
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="p-3.5 border-t border-border-light flex items-center justify-between text-xs text-stone-500 bg-stone-50/40">
                <div>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} entries
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 border border-border-light rounded-lg hover:bg-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="px-3 py-1 font-mono font-bold text-stone-700">
                    {page} / {Math.ceil(total / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                    disabled={page >= Math.ceil(total / PAGE_SIZE)}
                    className="p-1.5 border border-border-light rounded-lg hover:bg-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =============================================================
          TAB 2: RECIPES (BOM) MANAGEMENT
          ============================================================= */}
      {activeTab === "recipes" && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                <ChefHat size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-900">
                  Automatic Bill of Materials (BOM) Consumption
                </h3>
                <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                  Map raw kitchen ingredients (from your PDF stock list) to menu items. Whenever a cashier sells an item at POS, all mapped ingredients automatically deduct from your inventory ledger!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-white/80 border border-emerald-200 px-3 py-1.5 rounded-lg text-center">
                <span className="text-[9px] font-bold text-emerald-600 uppercase block">Configured</span>
                <span className="text-sm font-extrabold text-emerald-900">{recipes.length} / {menuItems.length}</span>
              </div>
            </div>
          </div>

          {/* Recipes Filters */}
          <div className="bg-panel border border-border-light rounded-xl p-4 shadow-xs flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={recipeCategoryFilter}
                onChange={(e) => setRecipeCategoryFilter(e.target.value)}
                className="text-xs border border-border-light rounded-lg px-2.5 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-brand/40"
              >
                <option value="all">All Menu Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Configured status filter */}
              <div className="flex bg-stone-100 rounded-lg p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRecipeConfigFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    recipeConfigFilter === "all" ? "bg-white text-stone-800 shadow-xs" : "text-stone-500"
                  }`}
                >
                  All ({menuItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecipeConfigFilter("configured")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    recipeConfigFilter === "configured" ? "bg-white text-emerald-800 shadow-xs" : "text-stone-500"
                  }`}
                >
                  Configured ({recipes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecipeConfigFilter("unconfigured")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    recipeConfigFilter === "unconfigured" ? "bg-white text-amber-800 shadow-xs" : "text-stone-500"
                  }`}
                >
                  No Recipe ({menuItems.length - recipes.length})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Search menu items..."
                className="text-xs border border-border-light rounded-lg pl-7 pr-7 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-brand/40 w-56"
              />
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              {recipeSearch && (
                <button
                  onClick={() => setRecipeSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Menu Items Recipe Grid */}
          {recipesLoading ? (
            <div className="bg-panel border border-border-light rounded-xl p-12 text-center text-stone-400">
              <div className="inline-block w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin mb-2" />
              <div className="text-xs font-semibold">Loading recipes & BOM...</div>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="bg-panel border border-border-light rounded-xl p-12 text-center text-stone-400">
              <ChefHat size={32} className="mx-auto mb-2 text-stone-300" />
              <p className="font-semibold text-stone-700">No menu items found</p>
              <p className="text-xs text-stone-400 mt-0.5">Try clearing your search or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMenuItems.map((item) => {
                const recipe = recipeMap.get(item.id);
                const hasRecipe = !!recipe && recipe.items.length > 0;
                const sellingPriceRupees = paiseToRupees(item.price);
                const foodCostRupees = hasRecipe ? paiseToRupees(recipe.totalCostPaise) : paiseToRupees(item.costPrice);
                const grossMarginRupees = sellingPriceRupees - foodCostRupees;
                const marginPercent =
                  sellingPriceRupees > 0
                    ? ((grossMarginRupees / sellingPriceRupees) * 100).toFixed(0)
                    : "0";

                return (
                  <div
                    key={item.id}
                    className={`bg-panel border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                      hasRecipe
                        ? "border-border-light hover:border-emerald-300"
                        : "border-dashed border-stone-300 bg-stone-50/40"
                    }`}
                  >
                    <div>
                      {/* Top row: Name, Category, Price */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-stone-800 text-sm">{item.name}</span>
                            {hasRecipe ? (
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-md font-extrabold flex items-center gap-1">
                                <CheckCircle2 size={10} /> Active BOM
                              </span>
                            ) : (
                              <span className="text-[10px] bg-stone-100 text-stone-500 border border-stone-200 px-1.5 py-0.2 rounded-md font-semibold">
                                Direct Product
                              </span>
                            )}
                          </div>
                          {item.category && (
                            <span className="text-[10px] text-stone-400 font-medium">
                              {item.category.name}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold text-stone-800 font-display block">
                            {formatCurrency(item.price)}
                          </span>
                          <span className="text-[10px] text-stone-400 uppercase font-semibold">Selling Price</span>
                        </div>
                      </div>

                      {/* Middle: Recipe Ingredients list */}
                      <div className="bg-stone-50 rounded-lg p-2.5 border border-border-light/60 my-2">
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                          <span>Ingredients Required (per portion)</span>
                          {hasRecipe && (
                            <span className="text-emerald-700 font-mono font-bold">
                              {recipe.items.length} mapped
                            </span>
                          )}
                        </div>

                        {hasRecipe ? (
                          <div className="flex flex-wrap gap-1.5">
                            {recipe.items.map((it) => (
                              <span
                                key={it.id || it.ingredientId}
                                className="inline-flex items-center gap-1 bg-white border border-stone-200 px-2 py-0.5 rounded-md text-[11px] text-stone-700"
                              >
                                <span className="font-semibold">{it.ingredient?.name}</span>
                                <span className="text-brand font-mono font-bold">
                                  {it.quantity} {it.unit}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-stone-400 italic">
                            No BOM configured. Selling this item will only deduct the finished menu item itself.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom row: Food Cost, Margin %, Edit Button */}
                    <div className="pt-3 border-t border-border-light flex items-center justify-between mt-2">
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-stone-400 block font-medium">Est. Food Cost</span>
                          <span className="font-mono font-bold text-stone-700">
                            ₹{foodCostRupees.toFixed(2)}
                          </span>
                        </div>
                        {sellingPriceRupees > 0 && (
                          <div>
                            <span className="text-[10px] text-stone-400 block font-medium">Profit Margin</span>
                            <span
                              className={`font-mono font-bold ${
                                Number(marginPercent) >= 60
                                  ? "text-emerald-700"
                                  : Number(marginPercent) >= 40
                                  ? "text-blue-700"
                                  : "text-amber-700"
                              }`}
                            >
                              {marginPercent}% (₹{grossMarginRupees.toFixed(0)})
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenRecipeModal(item)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                          hasRecipe
                            ? "bg-white border border-border-light text-stone-700 hover:bg-stone-50"
                            : "bg-brand hover:bg-brand-dark text-white shadow-xs"
                        }`}
                      >
                        <ChefHat size={12} />
                        {hasRecipe ? "Edit Recipe" : "Configure BOM"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =============================================================
          MODAL: ADD STOCK / PURCHASE (Existing)
          ============================================================= */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-light pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-stone-800">Add Stock / Inventory Entry</h3>
                <p className="text-xs text-stone-500 font-medium">Record purchases, adjustments, damages or opening counts</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStockEntry} className="space-y-3.5">
              {/* Entry Type */}
              <div>
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">Entry Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ENTRY_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        form.type === t
                          ? "bg-brand text-white border-brand shadow-xs"
                          : "bg-white border-border-light text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {TYPE_META[t]?.label ?? t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product */}
              <div>
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">Product</label>
                <select
                  value={form.productId}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      productId: e.target.value,
                      costPriceRupees: found?.costPrice ? String(paiseToRupees(found.costPrice)) : f.costPriceRupees,
                    }));
                  }}
                  required
                  className="w-full border border-border-light rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand/40 bg-white cursor-pointer"
                >
                  <option value="">— Select product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Qty + Cost Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">
                    Quantity {form.type === "DAMAGE" ? "(negative = remove)" : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.qty}
                    onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                    placeholder={form.type === "DAMAGE" ? "e.g. -5" : "e.g. 50"}
                    required
                    className="w-full border border-border-light rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand/40"
                  />
                </div>
                {form.type === "PURCHASE" && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">Unit Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costPriceRupees}
                      onChange={(e) => setForm((f) => ({ ...f, costPriceRupees: e.target.value }))}
                      placeholder="e.g. 35.00"
                      className="w-full border border-border-light rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand/40"
                    />
                  </div>
                )}
              </div>

              {/* Supplier + Ref (for purchases) */}
              {form.type === "PURCHASE" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">Supplier Name</label>
                    <input
                      type="text"
                      value={form.supplierName}
                      onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))}
                      placeholder="e.g. Ali Traders"
                      className="w-full border border-border-light rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand/40"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">Invoice / Ref No.</label>
                    <input
                      type="text"
                      value={form.referenceNo}
                      onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
                      placeholder="e.g. INV-2025-001"
                      className="w-full border border-border-light rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand/40"
                    />
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wide block mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Received from morning delivery"
                  className="w-full border border-border-light rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand/40"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-border-light rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Plus size={13} /> Save Stock Entry</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL: RECIPE / BOM EDITOR
          ============================================================= */}
      {showRecipeModal && selectedMenuProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-light pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <ChefHat size={18} className="text-brand" />
                  <h3 className="font-display font-bold text-base text-stone-800">
                    Recipe / BOM: {selectedMenuProduct.name}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Specify raw ingredients consumed whenever 1 portion is sold at POS
                </p>
              </div>
              <button
                onClick={() => setShowRecipeModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Price & Cost Summary Bar */}
            <div className="bg-stone-50 border border-border-light rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] text-stone-400 uppercase font-bold block">Selling Price</span>
                <span className="text-sm font-display font-extrabold text-stone-900">
                  {formatCurrency(selectedMenuProduct.price)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 uppercase font-bold block">Est. Food Cost</span>
                <span className="text-sm font-display font-extrabold text-emerald-700">
                  {formatCurrency(currentModalCostPaise)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 uppercase font-bold block">Gross Margin</span>
                <span className="text-sm font-display font-extrabold text-brand">
                  {formatCurrency(Math.max(0, selectedMenuProduct.price - currentModalCostPaise))}
                  {" "}
                  <span className="text-xs font-mono text-stone-500 font-normal">
                    (
                    {selectedMenuProduct.price > 0
                      ? (
                          ((selectedMenuProduct.price - currentModalCostPaise) / selectedMenuProduct.price) *
                          100
                        ).toFixed(0)
                      : 0}
                    %)
                  </span>
                </span>
              </div>
            </div>

            {/* Ingredients Form List (Scrollable) */}
            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">
                  Raw Ingredients Required
                </span>
                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Ingredient
                </button>
              </div>

              {editingItems.map((row, index) => {
                const ing = products.find((p) => p.id === row.ingredientId);
                const lineCostPaise = ing && row.quantity ? Math.round((ing.costPrice || 0) * row.quantity) : 0;

                return (
                  <div
                    key={index}
                    className="p-3 bg-stone-50/70 border border-border-light rounded-xl space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Ingredient selector */}
                      <div className="col-span-6">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                          Ingredient #{index + 1}
                        </label>
                        <select
                          value={row.ingredientId}
                          onChange={(e) => handleUpdateIngredientRow(index, "ingredientId", e.target.value)}
                          className="w-full border border-border-light rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-brand/40 cursor-pointer"
                        >
                          <option value="">— Select ingredient —</option>
                          {ingredientChoices.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit}) — Cost: ₹{paiseToRupees(p.costPrice).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-3">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdateIngredientRow(index, "quantity", parseFloat(e.target.value) || 0)
                          }
                          placeholder="e.g. 0.15"
                          className="w-full border border-border-light rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-brand/40 font-mono font-bold text-right"
                        />
                      </div>

                      {/* Unit */}
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleUpdateIngredientRow(index, "unit", e.target.value)}
                          placeholder="pcs / kg"
                          className="w-full border border-border-light rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-brand/40 font-mono text-center"
                        />
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 pt-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientRow(index)}
                          className="text-stone-400 hover:text-red-600 p-1.5 rounded-md cursor-pointer transition-colors"
                          title="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Cost preview for this ingredient */}
                    <div className="flex justify-between items-center text-[10px] text-stone-500 pt-1 border-t border-border-light/40">
                      <span>
                        Current Stock: <strong className="font-mono">{ing ? `${ing.stock} ${ing.unit}` : "—"}</strong>
                      </span>
                      <span>
                        Est. Cost: <strong className="font-mono text-stone-700">{formatCurrency(lineCostPaise)}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}

              {editingItems.length === 0 && (
                <div className="text-center py-6 text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                  <p className="text-xs font-semibold">No ingredients in this recipe</p>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-xs text-brand font-bold mt-1 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add First Ingredient
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="border-t border-border-light pt-3 flex items-center justify-between shrink-0">
              {recipeMap.has(selectedMenuProduct.id) ? (
                <button
                  type="button"
                  onClick={handleDeleteRecipe}
                  disabled={savingRecipe}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold px-3 py-2 rounded-xl hover:bg-red-50 cursor-pointer transition-colors"
                >
                  Delete Recipe
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecipeModal(false)}
                  className="px-4 py-2 border border-border-light rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={savingRecipe}
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                >
                  {savingRecipe ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><CheckCircle2 size={14} /> Save Recipe (BOM)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
