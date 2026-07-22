import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Tag, Loader2, Upload, ImageIcon, CornerDownRight } from 'lucide-react';
import { optimizeImage } from '@/lib/imageUpload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [parentId, setParentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setCategories(await base44.entities.Category.list('-created_date')); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Category.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const openCreate = () => { setEditing(null); setName(''); setDescription(''); setImageUrl(''); setParentId(''); setFormOpen(true); };
  const openEdit = (cat) => { setEditing(cat); setName(cat.name || ''); setDescription(cat.description || ''); setImageUrl(cat.image_url || ''); setParentId(cat.parent_category_id || ''); setFormOpen(true); };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
      setImageUrl(file_url);
    } catch {}
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Category.update(editing.id, { name, description, image_url: imageUrl, parent_category_id: parentId || null });
        await logAction('Categoria Editada', name);
      } else {
        await base44.entities.Category.create({ name, description, image_url: imageUrl, parent_category_id: parentId || null });
        await logAction('Categoria Criada', name);
      }
      setFormOpen(false);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Excluir a categoria "${cat.name}"?`)) return;
    await base44.entities.Category.delete(cat.id);
    await logAction('Categoria Excluída', cat.name);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
          <p className="text-sm text-slate-500">{categories.length} categorias cadastradas</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Tag className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhuma categoria cadastrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.filter(c => !c.parent_category_id).map(parent => {
            const children = categories.filter(c => c.parent_category_id === parent.id);
            return (
              <div key={parent.id}>
                <CategoryRow cat={parent} onEdit={openEdit} onDelete={handleDelete} />
                {children.length > 0 && (
                  <div className="ml-8 mt-2 space-y-2">
                    {children.map(child => (
                      <div key={child.id} className="flex items-start gap-1">
                        <CornerDownRight className="w-4 h-4 text-slate-300 mt-4 flex-shrink-0" />
                        <div className="flex-1"><CategoryRow cat={child} onEdit={openEdit} onDelete={handleDelete} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Imagem da Categoria</Label>
              <div className="mt-1 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
                  {imageUrl ? <img src={imageUrl} alt="Categoria" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Enviando...' : 'Enviar Imagem'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
                {imageUrl && (
                  <button type="button" onClick={() => setImageUrl('')} className="text-xs text-red-500 hover:text-red-600">Remover</button>
                )}
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="Ex: Arroz" />
            </div>
            <div>
              <Label>Categoria Pai (opcional)</Label>
              <Select value={parentId || 'none'} onValueChange={v => setParentId(v === 'none' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhuma (categoria principal)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (categoria principal)</SelectItem>
                  {categories.filter(c => !c.parent_category_id && c.id !== editing?.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Deixe em branco pra ser uma categoria principal; escolha uma pra virar subcategoria dela.</p>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" placeholder="Opcional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function CategoryRow({ cat, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-emerald-50 flex items-center justify-center flex-shrink-0">
        {cat.image_url ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" /> : <Tag className="w-5 h-5 text-emerald-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{cat.name}</p>
        {cat.description && <p className="text-xs text-slate-400 truncate">{cat.description}</p>}
      </div>
      <button onClick={() => onEdit(cat)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={() => onDelete(cat)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
