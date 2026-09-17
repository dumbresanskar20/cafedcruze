import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Check, Image as ImageIcon, Upload, AlertCircle, AlertTriangle, Search, ChevronDown, Clock, Sparkles } from 'lucide-react';
import api from '../services/api';
import CachedImage from './CachedImage';
import { preloadImages } from '../utils/imageCache';

export default function MenuManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMeal, setFilterMeal] = useState('');
  const [mealTypes, setMealTypes] = useState(['breakfast', 'lunch', 'snacks', 'dinner']);

  // Modal State for Menu Item
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form Fields for Menu Item
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Chapati / Quantity Variant States
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState([
    { id: '2_chapati', name: '2 Chapati', quantity: 2, price: '' },
    { id: '3_chapati', name: '3 Chapati', quantity: 3, price: '' },
  ]);

  // Modal State for Creating New Meal Type
  const [isNewMealTypeModalOpen, setIsNewMealTypeModalOpen] = useState(false);
  const [newMealTypeName, setNewMealTypeName] = useState('');
  const [newMealStartTime, setNewMealStartTime] = useState('08:00');
  const [newMealEndTime, setNewMealEndTime] = useState('20:00');
  const [newMealIsFullDay, setNewMealIsFullDay] = useState(false);
  const [newMealDiscountPercentage, setNewMealDiscountPercentage] = useState(10);
  const [newMealDiscountCutoff, setNewMealDiscountCutoff] = useState('12:00');
  const [newMealDiscountEnabled, setNewMealDiscountEnabled] = useState(true);
  const [creatingMealType, setCreatingMealType] = useState(false);

  // Modal State for Renaming Existing Meal Type
  const [isRenameMealTypeModalOpen, setIsRenameMealTypeModalOpen] = useState(false);
  const [renameTargetType, setRenameTargetType] = useState('');
  const [renameNewTypeName, setRenameNewTypeName] = useState('');
  const [renamingMealType, setRenamingMealType] = useState(false);

  // Recipe Configuration States
  const [recipeItems, setRecipeItems] = useState([]);
  const [allInventoryItems, setAllInventoryItems] = useState([]);

  const getAvailableUnits = (baseUnit) => {
    const clean = (baseUnit || '').toLowerCase();
    if (clean === 'kg') return ['kg', 'g'];
    if (clean === 'litre') return ['litre', 'ml'];
    if (clean) return [clean];
    return [];
  };

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchMenuItems();
    fetchInventoryItems();
    fetchMealTypes();
  }, [filterMeal]);

  const fetchMealTypes = async () => {
    try {
      const res = await api.get('/menu/windows');
      if (res.data && res.data.windows) {
        const types = res.data.windows.map((w) => (w.meal_type || '').toLowerCase());
        const defaults = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const merged = Array.from(new Set([...defaults, ...types].filter(Boolean)));
        setMealTypes(merged);
      }
    } catch (err) {
      console.warn('Failed to load meal types:', err.message);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await api.get('/inventory?limit=1000&is_active=true');
      if (res.data.success) {
        setAllInventoryItems(res.data.items || []);
      }
    } catch (err) {
      console.error('Error loading active inventory items:', err);
    }
  };

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      let url = '/menu/items';
      if (filterMeal) url += `?meal_type=${filterMeal}`;
      const res = await api.get(url);
      if (res.data.success) {
        const fetchedItems = res.data.items || [];
        setItems(fetchedItems);
        preloadImages(fetchedItems.map((i) => i.image_url));
      }
    } catch (err) {
      showToast('Error loading menu items.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setPrice('');
    setMealType(mealTypes[0] || 'breakfast');
    setImageUrl('');
    setImageFile(null);
    setImagePreview('');
    setDescription('');
    setIsActive(true);
    setRecipeItems([]);
    setHasVariants(false);
    setVariants([
      { id: '2_chapati', name: '2 Chapati', quantity: 2, price: '' },
      { id: '3_chapati', name: '3 Chapati', quantity: 3, price: '' },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(item.price.toString());
    setMealType(item.meal_type);
    setImageUrl(item.image_url || '');
    setImageFile(null);
    setImagePreview(item.image_url || '');
    setDescription(item.description || '');
    setIsActive(Boolean(item.is_active));

    setHasVariants(Boolean(item.has_variants));
    if (Array.isArray(item.variants) && item.variants.length > 0) {
      setVariants(
        item.variants.map((v) => ({
          id: v.id || `${v.quantity || 2}_chapati`,
          name: v.name || `${v.quantity || 2} Chapati`,
          quantity: Number(v.quantity) || 2,
          price: String(v.price != null ? v.price : ''),
        }))
      );
    } else {
      setVariants([
        { id: '2_chapati', name: '2 Chapati', quantity: 2, price: '' },
        { id: '3_chapati', name: '3 Chapati', quantity: 3, price: '' },
      ]);
    }

    // Fetch recipe
    setRecipeItems([]);
    const itemId = item.id || item._id;
    api.get(`/menu/items/${itemId}/recipe`)
      .then((res) => {
        if (res.data.success && res.data.recipe) {
          setRecipeItems(
            res.data.recipe.map((r) => ({
              inventory_item_id: r.inventory_item_id.toString(),
              quantity_required: r.quantity_required.toString(),
              quantity_unit: r.quantity_unit || (r.inventory_item ? r.inventory_item.unit : 'kg'),
            }))
          );
        }
      })
      .catch((err) => {
        console.error('Error fetching menu item recipe:', err);
      });

    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image file exceeds the 5MB size limit.', 'error');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Couldn\'t save — please enter the item name.', 'error');
      return;
    }

    let effectivePrice = Number(price);
    let validVariants = [];

    if (hasVariants) {
      validVariants = variants.filter(
        (v) => v.name && v.name.trim() && v.price !== '' && !isNaN(Number(v.price)) && Number(v.price) >= 0
      );
      if (validVariants.length === 0) {
        showToast('Please provide valid prices for your chapati / quantity options.', 'error');
        return;
      }
      if (!price || isNaN(effectivePrice) || effectivePrice <= 0) {
        effectivePrice = Math.min(...validVariants.map((v) => Number(v.price)));
      }
    } else if (!price || isNaN(effectivePrice)) {
      showToast('Couldn\'t save — please check the item price field.', 'error');
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', effectivePrice);
      formData.append('meal_type', mealType);
      formData.append('description', description);
      formData.append('is_active', isActive);
      formData.append('has_variants', hasVariants ? '1' : '0');
      formData.append(
        'variants',
        JSON.stringify(
          hasVariants
            ? validVariants.map((v) => ({
                id: v.id || `${v.quantity || 2}_chapati`,
                name: v.name.trim(),
                quantity: Number(v.quantity) || 2,
                price: Number(v.price),
              }))
            : []
        )
      );

      // Filter out incomplete recipe items and map types correctly
      const validRecipe = recipeItems
        .filter((r) => r.inventory_item_id && r.quantity_required && Number(r.quantity_required) > 0)
        .map((r) => {
          const inv = allInventoryItems.find(i => i.id.toString() === r.inventory_item_id.toString());
          return {
            inventory_item_id: parseInt(r.inventory_item_id, 10),
            quantity_required: parseFloat(r.quantity_required),
            quantity_unit: r.quantity_unit || (inv ? inv.unit : 'kg'),
          };
        });
      formData.append('recipe', JSON.stringify(validRecipe));

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageUrl) {
        formData.append('image_url', imageUrl);
      }

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      if (editingItem) {
        await api.put(`/menu/items/${editingItem._id}`, formData, config);
        showToast(`Item '${name}' saved successfully!`);
      } else {
        await api.post('/menu/items', formData, config);
        showToast(`New item '${name}' added to menu!`);
      }

      setIsModalOpen(false);
      fetchMenuItems();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Image upload failed — please try a smaller file or check your connection.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewMealType = async (e) => {
    e.preventDefault();
    if (!newMealTypeName.trim()) {
      showToast('Please enter a meal type name.', 'error');
      return;
    }

    const cleanMealType = newMealTypeName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    setCreatingMealType(true);

    try {
      const res = await api.post('/menu/meal-types', {
        meal_type: cleanMealType,
        start_time: newMealStartTime,
        end_time: newMealEndTime,
        is_full_day: newMealIsFullDay,
        is_active: true,
        discount_percentage: Number(newMealDiscountPercentage) || 10,
        cutoff_time: newMealDiscountCutoff || '12:00',
        discount_enabled: newMealDiscountEnabled,
      });

      if (res.data && res.data.success) {
        showToast(`🎉 New Meal Type '${cleanMealType}' created & synced with Discount Rules!`, 'success');
        await fetchMealTypes();
        setMealType(cleanMealType);
        setIsNewMealTypeModalOpen(false);
        setNewMealTypeName('');
      } else {
        showToast(res.data?.message || 'Failed to create meal type.', 'error');
      }
    } catch (err) {
      console.error('Error creating meal type:', err);
      showToast(err.response?.data?.message || err.message || 'Error creating meal type.', 'error');
    } finally {
      setCreatingMealType(false);
    }
  };

  const openRenameMealTypeModal = (targetType) => {
    const target = targetType || filterMeal || (mealTypes.length > 0 ? mealTypes[0] : 'breakfast');
    setRenameTargetType(target);
    setRenameNewTypeName(target);
    setIsRenameMealTypeModalOpen(true);
  };

  const handleRenameMealType = async (e) => {
    e.preventDefault();
    if (!renameTargetType) {
      showToast('Please select a meal type to rename.', 'error');
      return;
    }
    if (!renameNewTypeName.trim()) {
      showToast('Please enter a new meal type name.', 'error');
      return;
    }

    const cleanNewType = renameNewTypeName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (cleanNewType.length < 2) {
      showToast('Meal type name must be at least 2 characters.', 'error');
      return;
    }

    if (cleanNewType === renameTargetType.toLowerCase()) {
      showToast('The new name is the same as the current name.', 'error');
      return;
    }

    setRenamingMealType(true);
    try {
      const res = await api.put(`/menu/meal-types/${renameTargetType}/rename`, {
        new_meal_type: cleanNewType,
      });

      if (res.data && res.data.success) {
        showToast(`🎉 Meal type renamed from '${renameTargetType}' to '${cleanNewType}' successfully!`, 'success');
        await fetchMealTypes();
        // If the active filter or current menu item mealType matches the old name, update it
        if (filterMeal === renameTargetType) {
          setFilterMeal(cleanNewType);
        }
        if (mealType === renameTargetType) {
          setMealType(cleanNewType);
        }
        await fetchMenuItems();
        setIsRenameMealTypeModalOpen(false);
        setRenameTargetType('');
        setRenameNewTypeName('');
      } else {
        showToast(res.data?.message || 'Failed to rename meal type.', 'error');
      }
    } catch (err) {
      console.error('Error renaming meal type:', err);
      showToast(err.response?.data?.message || err.message || 'Error renaming meal type.', 'error');
    } finally {
      setRenamingMealType(false);
    }
  };

  const handleToggleActive = async (item) => {
    const itemId = item.id || item._id;
    if (!itemId || togglingIds.has(itemId)) return;

    const previousStatus = Boolean(item.is_active);
    const updatedStatus = !previousStatus;

    // Track active request to prevent rapid double-clicks
    setTogglingIds((prev) => new Set(prev).add(itemId));

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => {
        const iId = i.id || i._id;
        return iId === itemId ? { ...i, is_active: updatedStatus } : i;
      })
    );

    try {
      const res = await api.put(`/menu/items/${itemId}`, { is_active: updatedStatus });
      if (res.data && res.data.success) {
        const updatedItem = res.data.item;
        setItems((prev) =>
          prev.map((i) => {
            const iId = i.id || i._id;
            if (iId === itemId) {
              return {
                ...i,
                ...(updatedItem || {}),
                is_active: updatedStatus,
              };
            }
            return i;
          })
        );
        showToast(`Item '${item.name}' marked as ${updatedStatus ? 'Active' : 'Inactive'}.`, 'success');
      } else {
        throw new Error(res.data?.message || 'Failed to update item status');
      }
    } catch (err) {
      // Rollback on failure
      setItems((prev) =>
        prev.map((i) => {
          const iId = i.id || i._id;
          return iId === itemId ? { ...i, is_active: previousStatus } : i;
        })
      );
      const errMsg = err.response?.data?.message || err.message || 'Error updating item status.';
      showToast(errMsg, 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDeleteItem = async (id, itemName) => {
    if (!window.confirm(`Are you sure you want to delete '${itemName}'?`)) return;

    try {
      await api.delete(`/menu/items/${id}`);
      showToast(`Item '${itemName}' deleted.`);
      fetchMenuItems();
    } catch (err) {
      showToast('Error deleting item.', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6">

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2.5 animate-in slide-in-from-top-3 ${notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Menu Management</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Add food items, create custom meal categories, update prices, and configure recipe stock deductions
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsNewMealTypeModalOpen(true)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>New Meal Type</span>
          </button>

          <button
            type="button"
            onClick={() => openRenameMealTypeModal(filterMeal || (mealTypes.length > 0 ? mealTypes[0] : 'breakfast'))}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Edit2 className="w-4 h-4 text-blue-600" />
            <span>Rename Meal Type</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Menu Item</span>
          </button>
        </div>
      </div>

      {/* Dynamic Meal Filter Tabs */}
      <div className="flex gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setFilterMeal('')}
          className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all shrink-0 cursor-pointer ${filterMeal === '' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
        >
          All Categories
        </button>
        {mealTypes.map((m) => (
          <div
            key={m}
            className={`flex items-center rounded-xl text-xs font-bold capitalize transition-all shrink-0 overflow-hidden ${filterMeal === m ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
          >
            <button
              type="button"
              onClick={() => setFilterMeal(m)}
              className="pl-3.5 pr-1.5 py-2 cursor-pointer focus:outline-none"
            >
              {m}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openRenameMealTypeModal(m);
              }}
              title={`Rename '${m}' meal type`}
              className={`p-1.5 pr-2.5 transition-colors cursor-pointer ${filterMeal === m
                  ? 'text-slate-400 hover:text-emerald-400'
                  : 'text-slate-400 hover:text-blue-600'
                }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Menu Table / Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold">Loading menu catalog...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <p className="font-bold text-slate-600">No items found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const itemId = item.id || item._id;
            const isItemActive = Boolean(item.is_active);
            const isToggling = togglingIds.has(itemId);

            return (
              <div
                key={itemId}
                className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all duration-200 ${
                  isItemActive
                    ? 'border-slate-200 hover:shadow-md hover:border-slate-300'
                    : 'border-slate-200 bg-slate-50/75 opacity-75'
                }`}
              >
                <div>
                  <div className="relative h-44 bg-slate-100 rounded-xl overflow-hidden mb-3">
                    <CachedImage
                      src={item.image_url}
                      alt={item.name}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        !isItemActive ? 'grayscale-[35%]' : ''
                      }`}
                      fallbackIcon={<ImageIcon className="w-10 h-10 text-slate-400" />}
                    />

                    {/* Meal Type Badge */}
                    <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs">
                      {item.meal_type}
                    </div>

                    {/* Inactive Overlay Pill */}
                    {!isItemActive && (
                      <div className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-xs text-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-xs border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        <span>Inactive</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-slate-900 leading-snug">{item.name}</h3>
                    <span className="font-black text-emerald-700 text-base shrink-0">
                      {item.has_variants && Array.isArray(item.variants) && item.variants.length > 0
                        ? `From ₹${Math.min(...item.variants.map((v) => Number(v.price)))}`
                        : `₹${item.price}`}
                    </span>
                  </div>

                  {item.has_variants && Array.isArray(item.variants) && item.variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.variants.map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200/90 px-2 py-0.5 rounded-lg shadow-2xs"
                        >
                          <span>🫓 {v.name}:</span>
                          <span className="text-emerald-700 font-black">₹{v.price}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {item.description && (
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1.5">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Interactive Active / Inactive Functional Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(item);
                    }}
                    disabled={isToggling}
                    title={isItemActive ? `Click to deactivate '${item.name}'` : `Click to activate '${item.name}'`}
                    className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 border cursor-pointer select-none active:scale-95 shadow-2xs ${
                      isItemActive
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 hover:border-slate-300'
                    } ${isToggling ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {/* Animated Switch Track & Sliding Knob */}
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                        isItemActive ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                          isItemActive ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>

                    {/* Status Label */}
                    <span className="font-extrabold tracking-wide">
                      {isItemActive ? 'Active' : 'Inactive'}
                    </span>
                  </button>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title="Edit menu item"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(itemId, item.name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete menu item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create New Meal Type */}
      {isNewMealTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Create New Meal Type</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Adds a new meal category & auto-syncs with Discount Rules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewMealTypeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewMealType} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meal Type Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beverages, Brunch, Desserts, Late Night"
                  value={newMealTypeName}
                  onChange={(e) => setNewMealTypeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Full Day Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Full-Day (24/7) Ordering</span>
                  <span className="text-[10px] text-slate-500 font-medium">No time window restriction for ordering</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newMealIsFullDay}
                    onChange={(e) => setNewMealIsFullDay(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Operating Hours (if not full day) */}
              {!newMealIsFullDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Opening Time
                    </label>
                    <input
                      type="time"
                      required
                      value={newMealStartTime}
                      onChange={(e) => setNewMealStartTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Closing Time
                    </label>
                    <input
                      type="time"
                      required
                      value={newMealEndTime}
                      onChange={(e) => setNewMealEndTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Discount Rules Sync Section */}
              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">Automatic Discount Rule</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newMealDiscountEnabled}
                      onChange={(e) => setNewMealDiscountEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {newMealDiscountEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 mb-1">
                        Discount (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={newMealDiscountPercentage}
                        onChange={(e) => setNewMealDiscountPercentage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-bold text-purple-950 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 mb-1">
                        Cutoff Time
                      </label>
                      <input
                        type="time"
                        value={newMealDiscountCutoff}
                        onChange={(e) => setNewMealDiscountCutoff(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-bold text-purple-950 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-purple-700 font-medium">
                  This rule will automatically appear in Discount Settings and apply to student orders placed before cutoff.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewMealTypeModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingMealType}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creatingMealType ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Meal Type</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Existing Meal Type */}
      {isRenameMealTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Edit Meal Type Name</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Rename a meal category across the menu and ordering system</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRenameMealTypeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameMealType} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Meal Type to Rename
                </label>
                <select
                  value={renameTargetType}
                  onChange={(e) => {
                    setRenameTargetType(e.target.value);
                    setRenameNewTypeName(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none capitalize cursor-pointer"
                >
                  {mealTypes.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Breakfast, Brunch, Refreshments"
                  value={renameNewTypeName}
                  onChange={(e) => setRenameNewTypeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Will be saved as: <span className="font-bold text-slate-700">{renameNewTypeName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '...'}</span>
                </p>
              </div>

              {/* Informational Sync Note */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Automatic Synchronization</span>
                </div>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Renaming will automatically update all existing menu items, meal timing schedules, order records, and discount rules linked to <strong className="capitalize font-bold">{renameTargetType}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameMealTypeModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renamingMealType}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {renamingMealType ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Renaming...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save New Name</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Menu Item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapati Bhaji, Masala Dosa"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (!editingItem && val.toLowerCase().includes('chapati') && !hasVariants) {
                      setHasVariants(true);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {hasVariants ? 'Base Price (₹) (Auto-calculated)' : 'Price (₹)'}
                  </label>
                  <input
                    type="number"
                    required={!hasVariants}
                    min="0"
                    placeholder={
                      hasVariants
                        ? variants.some((v) => v.price !== '' && !isNaN(Number(v.price)))
                          ? `₹${Math.min(...variants.filter((v) => v.price !== '' && !isNaN(Number(v.price))).map((v) => Number(v.price)))}`
                          : 'Auto-set from chapati prices below'
                        : 'e.g. 50'
                    }
                    value={
                      hasVariants && variants.some((v) => v.price !== '' && !isNaN(Number(v.price)))
                        ? Math.min(...variants.filter((v) => v.price !== '' && !isNaN(Number(v.price))).map((v) => Number(v.price)))
                        : price
                    }
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={hasVariants && variants.some((v) => v.price !== '' && !isNaN(Number(v.price)))}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none font-medium ${
                      hasVariants && variants.some((v) => v.price !== '' && !isNaN(Number(v.price)))
                        ? 'bg-amber-50/60 border-amber-300 text-amber-950 font-black cursor-not-allowed'
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-600'
                    }`}
                  />
                  {hasVariants && (
                    <p className="text-[10px] text-amber-700 font-semibold mt-1">
                      * Starting price automatically reflects your lowest chapati option below.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Meal Type</label>
                    <button
                      type="button"
                      onClick={() => setIsNewMealTypeModalOpen(true)}
                      className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      + New Meal Type
                    </button>
                  </div>
                  <select
                    value={mealType}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') {
                        setIsNewMealTypeModalOpen(true);
                      } else {
                        setMealType(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium capitalize"
                  >
                    {mealTypes.map((t) => (
                      <option key={t} value={t} className="capitalize">
                        {t}
                      </option>
                    ))}
                    <option value="__create_new__" className="text-emerald-700 font-bold">
                      + Create New Meal Type...
                    </option>
                  </select>
                </div>
              </div>

              {/* Chapati / Quantity Options (Portion Pricing) */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🫓</span>
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                        Chapati / Quantity-Based Pricing
                      </h4>
                      <p className="text-[11px] text-amber-800 font-medium">
                        Independently select chapati quantities (e.g. 2, 3, 4) and set distinct prices for each.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasVariants(checked);
                        if (checked && (!variants || variants.length === 0)) {
                          setVariants([
                            { id: '2_chapati', name: '2 Chapati', quantity: 2, price: '' },
                            { id: '3_chapati', name: '3 Chapati', quantity: 3, price: '' },
                          ]);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {hasVariants && (
                  <div className="space-y-3 pt-2.5 border-t border-amber-200/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wide block">
                          Chapati Quantities & Custom Prices
                        </span>
                        <span className="text-[10px] text-amber-700 font-medium">
                          Add, remove, or change any chapati quantity and its custom price.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const existingQuantities = variants.map((v) => Number(v.quantity) || 0);
                          let nextQty = 2;
                          for (let q = 1; q <= 10; q++) {
                            if (!existingQuantities.includes(q)) {
                              nextQty = q;
                              break;
                            }
                          }
                          if (existingQuantities.includes(nextQty)) {
                            nextQty = Math.max(...existingQuantities, 0) + 1;
                          }
                          setVariants([
                            ...variants,
                            {
                              id: `${nextQty}_chapati`,
                              name: `${nextQty} Chapati`,
                              quantity: nextQty,
                              price: '',
                            },
                          ]);
                        }}
                        className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Quantity Option</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {variants.map((v, idx) => {
                        const standardCounts = [1, 2, 3, 4, 5, 6, 7, 8];
                        const isStandard = standardCounts.includes(Number(v.quantity));
                        return (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                              {/* Quantity Selector Dropdown */}
                              <div className="w-full sm:w-48">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                  <span>🫓 Chapati Quantity</span>
                                </label>
                                <select
                                  value={isStandard ? v.quantity : 'custom'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = [...variants];
                                    if (val === 'custom') {
                                      updated[idx].isCustom = true;
                                    } else {
                                      const num = Number(val);
                                      updated[idx].quantity = num;
                                      updated[idx].name = `${num} Chapati`;
                                      updated[idx].id = `${num}_chapati`;
                                      updated[idx].isCustom = false;
                                    }
                                    setVariants(updated);
                                  }}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                >
                                  {standardCounts.map((count) => (
                                    <option key={count} value={count}>
                                      {count} {count === 1 ? 'Chapati' : 'Chapatis'}
                                    </option>
                                  ))}
                                  <option value="custom">Custom Quantity...</option>
                                </select>
                              </div>

                              {/* If Custom Quantity, show direct number input */}
                              {(!isStandard || v.isCustom) && (
                                <div className="w-24">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Count
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Qty"
                                    value={v.quantity || ''}
                                    onChange={(e) => {
                                      const num = Number(e.target.value);
                                      const updated = [...variants];
                                      updated[idx].quantity = num;
                                      updated[idx].name = `${num} Chapati`;
                                      updated[idx].id = `${num}_chapati`;
                                      setVariants(updated);
                                    }}
                                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                  />
                                </div>
                              )}

                              {/* Price Input */}
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Price for {v.quantity || '?'} {Number(v.quantity) === 1 ? 'Chapati' : 'Chapatis'} (₹)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="e.g. 40"
                                    value={v.price}
                                    onChange={(e) => {
                                      const updated = [...variants];
                                      updated[idx].price = e.target.value;
                                      setVariants(updated);
                                    }}
                                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-emerald-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                  />
                                </div>
                              </div>

                              {/* Remove Button */}
                              {variants.length > 1 && (
                                <div className="sm:self-end pb-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                                    title="Remove this chapati option"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Option preview and optional label customization */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <span className="flex items-center gap-1 font-medium">
                                <span>Student sees:</span>
                                <strong className="text-slate-900 font-bold">
                                  {v.name || `${v.quantity} Chapati`}
                                </strong>
                                {v.price && (
                                  <span className="text-emerald-700 font-black">
                                    • ₹{v.price}
                                  </span>
                                )}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...variants];
                                  updated[idx].showEditLabel = !updated[idx].showEditLabel;
                                  setVariants(updated);
                                }}
                                className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                              >
                                {v.showEditLabel ? 'Hide Custom Label' : 'Customize Label'}
                              </button>
                            </div>

                            {v.showEditLabel && (
                              <div className="pt-1.5 animate-in fade-in">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                  Custom Display Label
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 2 Chapati + Bhaji"
                                  value={v.name}
                                  onChange={(e) => {
                                    const updated = [...variants];
                                    updated[idx].name = e.target.value;
                                    setVariants(updated);
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-2.5 bg-amber-100/60 rounded-xl border border-amber-200/80 text-[11px] text-amber-950 font-medium space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-900">
                        <span>💡 How it works:</span>
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-900/90 text-[10px]">
                        <li>Admin independently selects the chapati count (1, 2, 3, 4...) and enters the price for each portion.</li>
                        <li>When a student selects this item, they are asked for their preferred chapati quantity with live price updates.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Upload Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Food Image</label>

                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{imageFile ? imageFile.name : 'Upload Image File (Max 5MB)'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {imagePreview && (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 mt-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                        setImageUrl('');
                      }}
                      className="absolute top-1 right-1 bg-slate-900/80 text-white rounded-full p-1 hover:bg-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              {/* Recipe Ingredients Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Automatic Stock Deduction (Recipe)
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Select inventory ingredients deducted when an order is completed.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRecipeItems([
                        ...recipeItems,
                        { inventory_item_id: '', quantity_required: '', quantity_unit: '' },
                      ]);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                {recipeItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No recipe configured. Inventory will not be automatically deducted.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {recipeItems.map((r, idx) => {
                      const selectedInv = allInventoryItems.find((i) => i.id.toString() === r.inventory_item_id.toString());
                      const selectedIdsInOtherRows = recipeItems
                        .filter((_, i) => i !== idx)
                        .map((item) => item.inventory_item_id.toString());

                      return (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              list={`ingredients-list-${idx}`}
                              value={
                                selectedInv
                                  ? `${selectedInv.name} (${selectedInv.unique_inventory_id})`
                                  : r.inventory_item_id
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                const matched = allInventoryItems.find(
                                  (i) => `${i.name} (${i.unique_inventory_id})` === val || i.name.toLowerCase() === val.toLowerCase()
                                );
                                const updated = [...recipeItems];
                                if (matched) {
                                  updated[idx].inventory_item_id = matched.id.toString();
                                  updated[idx].quantity_unit = matched.unit || 'kg';
                                } else {
                                  updated[idx].inventory_item_id = val;
                                  updated[idx].quantity_unit = '';
                                }
                                setRecipeItems(updated);
                              }}
                              placeholder="Select ingredient..."
                              className="w-full pl-2.5 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none font-semibold focus:ring-1 focus:ring-emerald-500 bg-white"
                              required
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <datalist id={`ingredients-list-${idx}`}>
                              {allInventoryItems.map((item) => {
                                const isAlreadySelected = selectedIdsInOtherRows.includes(item.id.toString());
                                if (isAlreadySelected) return null;
                                return (
                                  <option key={item.id} value={`${item.name} (${item.unique_inventory_id})`}>
                                    Available: {item.quantity_in_stock} {item.unit}
                                  </option>
                                );
                              })}
                            </datalist>
                            {selectedInv && (
                              <div className="text-[10px] text-slate-500 font-semibold mt-0.5 px-1 flex items-center gap-1">
                                <span>In Stock:</span>
                                <span className={`font-bold ${Number(selectedInv.quantity_in_stock) <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {selectedInv.quantity_in_stock} {selectedInv.unit}
                                </span>
                              </div>
                            )}
                          </div>

                          <select
                            value={r.quantity_unit || (selectedInv ? selectedInv.unit : '')}
                            onChange={(e) => {
                              const updated = [...recipeItems];
                              updated[idx].quantity_unit = e.target.value;
                              setRecipeItems(updated);
                            }}
                            className="w-24 px-2 py-2 border border-slate-300 rounded-xl text-xs outline-none bg-white text-slate-700 font-semibold focus:ring-1 focus:ring-emerald-500"
                            required
                            disabled={!selectedInv}
                          >
                            <option value="">Unit</option>
                            {selectedInv && getAvailableUnits(selectedInv.unit).map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>

                          <div className="relative w-24">
                            <input
                              type="number"
                              step="0.001"
                              placeholder="Qty"
                              value={r.quantity_required}
                              onChange={(e) => {
                                const updated = [...recipeItems];
                                updated[idx].quantity_required = e.target.value;
                                setRecipeItems(updated);
                              }}
                              className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none font-semibold"
                              required
                              min="0.001"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setRecipeItems(recipeItems.filter((_, i) => i !== idx));
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="activeCheck" className="text-xs font-bold text-slate-700">
                  Item is active and available for ordering
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? 'Saving Menu Item...' : 'Save Menu Item'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
