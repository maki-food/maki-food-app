import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { logAction } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Layers, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function VariantTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setTypes(await base44.entities.VariantType.list('name')); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.VariantType.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const openCreate = () => { setEditing(null); setName(''); setFormOpen(true); };
  const openEdit = (t) => { setEditing(t); setName(t.name || ''); setFormOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.VariantType.update(editing.id, { name });
        await logAction('Tipo de Variação Editado', name);
      } else {
        await base44.entities.VariantType.create({ name });
        await logAction('Tipo de Variação Criado', name);
      }
      setFormOpen(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message || 'Tente novamente.' });
    }
    setSaving(false);
  };

  const handleDelete = async (t) => {
    if (!confirm(`Excluir o tipo de variação "${t.name}"? Produtos que já usam esse tipo não serão apagados, apenas perdem essa classificação.`)) return;
    try {
      await base44.entities.VariantType.delete(t.id);
      await logAction('Tipo de Variação Excluído', t.name);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message || 'Tente novamente.' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tipos de Variação</h1>
          <p className="text-sm text-slate-500">Ex: Cor, Tamanho, Formato de Venda — use ao cadastrar variações de um produto</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Novo Tipo
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Layers className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum tipo de variação cadastrado</p>
          <p className="text-sm mt-1">Ex: "Formato de Venda" (Caixa / Unidade / Filé)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {types.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{t.name}</p>
              </div>
              <button onClick={() => openEdit(t)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(t)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tipo de Variação' : 'Novo Tipo de Variação'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="Ex: Formato de Venda" />
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
