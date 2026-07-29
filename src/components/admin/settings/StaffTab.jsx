import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatDate } from '@/lib/format';
import { logAction } from '@/lib/audit';
import { maskPhone } from '@/lib/masks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { User, Mail, Shield, Loader2, UserPlus, Users, Bike, Store, Pencil, Trash2, Phone } from 'lucide-react';

const roleConfig = {
  admin: { label: 'Administrador', icon: Shield, color: 'bg-emerald-100 text-emerald-600' },
  seller: { label: 'Vendedor', icon: User, color: 'bg-blue-100 text-blue-600' },
  deliverer: { label: 'Entregador', icon: Bike, color: 'bg-purple-100 text-purple-600' },
  user: { label: 'Cliente', icon: Store, color: 'bg-amber-100 text-amber-600' },
};

export default function StaffTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ full_name: '', email: '', password: '', contact_number: '', role: 'seller' });
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', contact_number: '', role: 'user' });
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    try { setUsers(await base44.entities.User.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    setRegError('');
    try {
      await base44.auth.adminCreateStaff({
        email: regForm.email,
        password: regForm.password,
        fullName: regForm.full_name,
        role: regForm.role,
        contactNumber: regForm.contact_number,
      });
      await logAction('Funcionário Cadastrado', `${regForm.full_name || regForm.email} - ${roleConfig[regForm.role]?.label || regForm.role}`);
      setRegisterOpen(false);
      setRegForm({ full_name: '', email: '', password: '', contact_number: '', role: 'seller' });
      load();
    } catch (err) {
      setRegError(err.message || 'Erro ao cadastrar funcionário. Verifique se o e-mail já não está cadastrado.');
    }
    setRegistering(false);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name || '',
      email: u.email || '',
      contact_number: u.contact_number || '',
      role: u.role || 'user',
      new_password: '',
    });
    setEditError('');
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    setEditError('');
    try {
      await base44.entities.User.update(editingUser.id, {
        full_name: editForm.full_name,
        contact_number: editForm.contact_number,
        role: editForm.role,
      });
      if (editForm.email !== editingUser.email || editForm.new_password) {
        await base44.auth.adminUpdateStaffCredentials({
          userId: editingUser.id,
          newEmail: editForm.email !== editingUser.email ? editForm.email : null,
          newPassword: editForm.new_password || null,
        });
      }
      await logAction('Funcionário Editado', `${editForm.full_name || editForm.email}: ${roleConfig[editForm.role]?.label || editForm.role}`);
      setEditingUser(null);
      load();
    } catch (err) {
      setEditError(err.message || 'Erro ao salvar alterações.');
    }
    setSavingEdit(false);
  };

  const handleDelete = async (u) => {
    if (!confirm(`Remover ${u.full_name || u.email} da equipe?`)) return;
    try {
      await base44.entities.User.delete(u.id);
      await logAction('Usuário Removido', u.full_name || u.email);
      load();
    } catch {}
  };

  const [filter, setFilter] = useState('all'); // 'all' | 'staff' | 'clients'

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  const staffUsers = users.filter(u => u.role === 'admin' || u.role === 'seller' || u.role === 'deliverer');
  const clientUsers = users.filter(u => u.role === 'user' || !u.role);
  const visibleUsers = filter === 'staff' ? staffUsers : filter === 'clients' ? clientUsers : users;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1">
          <button onClick={() => setFilter('all')} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            Todos ({users.length})
          </button>
          <button onClick={() => setFilter('staff')} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            Equipe ({staffUsers.length})
          </button>
          <button onClick={() => setFilter('clients')} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter === 'clients' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            Clientes ({clientUsers.length})
          </button>
        </div>
        <Button onClick={() => setRegisterOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          <UserPlus className="w-4 h-4 mr-1" /> Cadastrar Funcionário
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleUsers.map(u => {
          const cfg = roleConfig[u.role] || roleConfig.user;
          const Icon = cfg.icon;
          return (
            <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{u.full_name || u.email}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</p>
                {u.contact_number && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.contact_number}</p>}
                <p className="text-xs text-slate-400 mt-0.5">Desde {formatDate(u.created_date)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(u)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(u)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {staffUsers.length === 0 && (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Users className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum funcionário cadastrado</p>
        </div>
      )}

      <Dialog open={registerOpen} onOpenChange={(o) => !o && setRegisterOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Funcionário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input required value={regForm.full_name} onChange={e => setRegForm({ ...regForm, full_name: e.target.value })} className="mt-1" placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" required value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} className="mt-1" placeholder="funcionario@email.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" required value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} className="mt-1" placeholder="••••••" minLength={6} />
            </div>
            <div>
              <Label>Telefone / Contato</Label>
              <Input value={regForm.contact_number} onChange={e => setRegForm({ ...regForm, contact_number: maskPhone(e.target.value) })} className="mt-1" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Função *</Label>
              <Select value={regForm.role} onValueChange={v => setRegForm({ ...regForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor</SelectItem>
                  <SelectItem value="deliverer">Entregador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {regError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{regError}</div>
            )}
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600 text-xs flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>O funcionário será cadastrado diretamente com a senha informada, sem necessidade de confirmação por e-mail. Já ficará pronto para login imediato.</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={registering} className="bg-emerald-600 hover:bg-emerald-700">
                {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input required value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="mt-1" placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="mt-1" placeholder="funcionario@email.com" />
            </div>
            <div>
              <Label>Telefone / Contato</Label>
              <Input value={editForm.contact_number} onChange={e => setEditForm({ ...editForm, contact_number: maskPhone(e.target.value) })} className="mt-1" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Nova Senha (opcional)</Label>
              <Input type="password" value={editForm.new_password} onChange={e => setEditForm({ ...editForm, new_password: e.target.value })} className="mt-1" placeholder="Deixe em branco pra manter a atual" minLength={6} />
            </div>
            <div>
              <Label>Função *</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor</SelectItem>
                  <SelectItem value="deliverer">Entregador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{editError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button type="button" disabled={savingEdit} onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700">
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}