import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { formatBRL, formatDate, formatDateShort, getOrderDisplayItems, getOrderItemQuantityLabel, getOrderItemSubtotal } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DateInput from '@/components/ui/date-input';
import { ArrowDownCircle, ArrowUpCircle, Banknote, Calendar, Eye, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const emptyEntry = { description: '', category: 'Reforço de caixa', amount: '', payment_method: 'Dinheiro', cash_amount: '', digital_amount: '', occurred_at: new Date().toISOString().slice(0, 10) };
const emptyExpense = { description: '', category: 'Despesa operacional', amount: '', payment_method: 'Dinheiro', cash_amount: '', digital_amount: '', occurred_at: new Date().toISOString().slice(0, 10) };

export default function CashFlow() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [showExpense, setShowExpense] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [expense, setExpense] = useState(emptyExpense);
  const [entry, setEntry] = useState(emptyEntry);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [relatedRecord, setRelatedRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setTransactions(await base44.entities.CashTransaction.list('-occurred_at', 500)); } catch (error) {
      const missingTable = error?.status === 'PGRST205' || error?.message?.includes("cash_transactions");
      toast({
        variant: 'destructive',
        title: missingTable ? 'Tabela do caixa ainda não criada' : 'Erro ao carregar fluxo de caixa',
        description: missingTable
          ? 'Execute a migration do arquivo supabase_migration.sql no SQL Editor do Supabase e recarregue esta página.'
          : error.message,
      });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.CashTransaction.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, []);

  const filtered = useMemo(() => transactions.filter(item => {
    const date = String(item.occurred_at || item.created_date || '').slice(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    if (filter !== 'all' && item.type !== filter) return false;
    if (search && !`${item.description} ${item.category} ${item.payment_method}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [transactions, dateFrom, dateTo, filter, search]);

  const summary = useMemo(() => filtered.reduce((result, item) => {
    const amount = Number(item.amount || 0);
    const cashAmount = Number(item.cash_amount || 0);
    const digitalAmount = Number(item.digital_amount || 0);
    const sign = item.type === 'entry' ? 1 : -1;
    result.entries += item.type === 'entry' ? amount : 0;
    result.expenses += item.type === 'expense' ? amount : 0;
    result.cash += sign * cashAmount;
    result.digital += sign * digitalAmount;
    return result;
  }, { entries: 0, expenses: 0, cash: 0, digital: 0 }), [filtered]);

  const saveExpense = async (event) => {
    event.preventDefault();
    const amount = Number(expense.amount || 0);
    if (!expense.description.trim() || amount <= 0) return;
    const cashAmount = expense.payment_method === 'Dinheiro' ? amount : expense.payment_method === 'Dinheiro e Pix' ? Number(expense.cash_amount || 0) : 0;
    const digitalAmount = expense.payment_method === 'Pix' ? amount : expense.payment_method === 'Cartão' ? amount : expense.payment_method === 'Dinheiro e Pix' ? Number(expense.digital_amount || 0) : 0;
    if (Math.abs(cashAmount + digitalAmount - amount) > 0.01) {
      toast({ variant: 'destructive', title: 'Valores inválidos', description: 'Os valores dos meios de pagamento precisam somar o total.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        description: expense.description.trim(),
        category: expense.category.trim() || 'Despesa operacional',
        type: 'expense',
        amount,
        payment_method: expense.payment_method,
        cash_amount: cashAmount,
        digital_amount: digitalAmount,
        occurred_at: `${expense.occurred_at}T12:00:00`,
        reference_type: null,
        reference_id: null,
      };
      if (editingExpenseId) {
        await base44.entities.CashTransaction.update(editingExpenseId, payload);
      } else {
        await base44.entities.CashTransaction.create(payload);
      }
      setExpense(emptyExpense);
      setEditingExpenseId(null);
      setShowExpense(false);
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao lançar despesa', description: error.message });
    } finally { setSaving(false); }
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    const amount = Number(entry.amount || 0);
    if (!entry.description.trim() || amount <= 0) return;
    const cashAmount = entry.payment_method === 'Dinheiro' ? amount : entry.payment_method === 'Dinheiro e Pix' ? Number(entry.cash_amount || 0) : 0;
    const digitalAmount = entry.payment_method === 'Pix' || entry.payment_method === 'Cartão' ? amount : entry.payment_method === 'Dinheiro e Pix' ? Number(entry.digital_amount || 0) : 0;
    if (Math.abs(cashAmount + digitalAmount - amount) > 0.01) {
      toast({ variant: 'destructive', title: 'Valores inválidos', description: 'Os valores dos meios de pagamento precisam somar o total.' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.CashTransaction.create({
        description: entry.description.trim(),
        category: entry.category.trim() || 'Reforço de caixa',
        type: 'entry',
        amount,
        payment_method: entry.payment_method,
        cash_amount: cashAmount,
        digital_amount: digitalAmount,
        occurred_at: `${entry.occurred_at}T12:00:00`,
        reference_type: null,
        reference_id: null,
      });
      setEntry(emptyEntry);
      setShowEntry(false);
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao lançar reforço', description: error.message });
    } finally { setSaving(false); }
  };

  const startEditing = (item) => {
    setEditingExpenseId(item.id);
    setExpense({
      description: item.description || '',
      category: item.category || 'Despesa operacional',
      amount: String(item.amount || ''),
      payment_method: item.payment_method || 'Dinheiro',
      cash_amount: item.cash_amount ? String(item.cash_amount) : '',
      digital_amount: item.digital_amount ? String(item.digital_amount) : '',
      occurred_at: String(item.occurred_at || item.created_date || '').slice(0, 10),
    });
    setShowExpense(true);
  };

  const deleteExpense = async (item) => {
    if (!window.confirm(`Excluir a despesa "${item.description}"?`)) return;
    try {
      await base44.entities.CashTransaction.delete(item.id);
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir despesa', description: error.message });
    }
  };

  const openDetails = async (item) => {
    setSelectedTransaction(item);
    setRelatedRecord(null);
    if (!item.reference_type || !item.reference_id) return;
    setDetailLoading(true);
    try {
      const entity = item.reference_type === 'order' ? base44.entities.Order : base44.entities.Purchase;
      setRelatedRecord(await entity.get(item.reference_id));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível carregar os detalhes', description: error.message });
    } finally { setDetailLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Fluxo de Caixa</h1><p className="text-sm text-slate-500">Acompanhe entradas, saídas e saldos do negócio.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setShowEntry(value => !value); setShowExpense(false); }} className="bg-green-600 hover:bg-green-700 text-white"><Plus className="w-4 h-4 mr-1" /> Reforço de caixa</Button>
          <Button variant="outline" onClick={() => { setShowExpense(value => !value); setShowEntry(false); }} className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"><Plus className="w-4 h-4 mr-1" /> Nova despesa</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-emerald-700"><ArrowUpCircle className="w-5 h-5" /><span className="text-sm">Entradas</span></div><p className="mt-2 text-xl font-bold text-emerald-800">{formatBRL(summary.entries)}</p></div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><div className="flex items-center gap-2 text-red-700"><ArrowDownCircle className="w-5 h-5" /><span className="text-sm">Saídas</span></div><p className="mt-2 text-xl font-bold text-red-800">{formatBRL(summary.expenses)}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-amber-700"><Banknote className="w-5 h-5" /><span className="text-sm">Caixa físico</span></div><p className="mt-2 text-xl font-bold text-amber-800">{formatBRL(summary.cash)}</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-center gap-2 text-blue-700"><Wallet className="w-5 h-5" /><span className="text-sm">Saldo digital</span></div><p className="mt-2 text-xl font-bold text-blue-800">{formatBRL(summary.digital)}</p></div>
      </div>

      {showExpense && <form onSubmit={saveExpense} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">{editingExpenseId ? 'Editar despesa manual' : 'Lançar despesa manual'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Descrição</Label><Input required value={expense.description} onChange={e => setExpense({ ...expense, description: e.target.value })} placeholder="Ex: Energia elétrica" /></div>
          <div><Label>Categoria</Label><Input value={expense.category} onChange={e => setExpense({ ...expense, category: e.target.value })} placeholder="Despesa operacional" /></div>
          <div><Label>Valor total</Label><Input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} placeholder="0,00" /></div>
          <div><Label>Data</Label><DateInput value={expense.occurred_at} onChange={value => setExpense({ ...expense, occurred_at: value })} /></div>
          <div><Label>Forma de pagamento</Label><select value={expense.payment_method} onChange={e => setExpense({ ...expense, payment_method: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Dinheiro e Pix</option></select></div>
          {expense.payment_method === 'Dinheiro e Pix' && <><div><Label>Valor em dinheiro</Label><Input required type="number" min="0" step="0.01" value={expense.cash_amount} onChange={e => setExpense({ ...expense, cash_amount: e.target.value })} /></div><div><Label>Valor em Pix</Label><Input required type="number" min="0" step="0.01" value={expense.digital_amount} onChange={e => setExpense({ ...expense, digital_amount: e.target.value })} /></div></>}
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setShowExpense(false); setEditingExpenseId(null); setExpense(emptyExpense); }}>Cancelar</Button><Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{editingExpenseId ? 'Salvar alterações' : 'Salvar despesa'}</Button></div>
      </form>}

      {showEntry && <form onSubmit={saveEntry} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Lançar reforço de caixa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Descrição</Label><Input required value={entry.description} onChange={e => setEntry({ ...entry, description: e.target.value })} placeholder="Ex: Aporte no caixa" /></div>
          <div><Label>Categoria</Label><Input value={entry.category} onChange={e => setEntry({ ...entry, category: e.target.value })} /></div>
          <div><Label>Valor total</Label><Input required type="number" min="0.01" step="0.01" value={entry.amount} onChange={e => setEntry({ ...entry, amount: e.target.value })} placeholder="0,00" /></div>
          <div><Label>Data</Label><DateInput value={entry.occurred_at} onChange={value => setEntry({ ...entry, occurred_at: value })} /></div>
          <div><Label>Origem do reforço</Label><select value={entry.payment_method} onChange={e => setEntry({ ...entry, payment_method: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Dinheiro e Pix</option></select></div>
          {entry.payment_method === 'Dinheiro e Pix' && <><div><Label>Valor em dinheiro</Label><Input required type="number" min="0" step="0.01" value={entry.cash_amount} onChange={e => setEntry({ ...entry, cash_amount: e.target.value })} /></div><div><Label>Valor em Pix</Label><Input required type="number" min="0" step="0.01" value={entry.digital_amount} onChange={e => setEntry({ ...entry, digital_amount: e.target.value })} /></div></>}
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setShowEntry(false); setEntry(emptyEntry); }}>Cancelar</Button><Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">Salvar reforço</Button></div>
      </form>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder="Buscar lançamento..." /></div>
          <div><Label className="text-xs">Tipo</Label><select value={filter} onChange={e => setFilter(e.target.value)} className="mt-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="all">Todos</option><option value="entry">Entradas</option><option value="expense">Saídas</option></select></div>
          <div><Label className="text-xs">De</Label><DateInput value={dateFrom} onChange={setDateFrom} /></div>
          <div><Label className="text-xs">Até</Label><DateInput value={dateTo} onChange={setDateTo} /></div>
          <Calendar className="mb-2 hidden sm:block w-4 h-4 text-slate-400" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center text-slate-400"><Wallet className="w-10 h-10 mx-auto mb-3" /><p>Nenhum lançamento encontrado.</p></div> : <div className="divide-y divide-slate-100">{filtered.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 p-4"><div className={`w-9 h-9 rounded-full flex items-center justify-center ${item.type === 'entry' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{item.type === 'entry' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}</div><div className="flex-1 min-w-[200px]"><p className="font-medium text-slate-900">{item.description}</p><p className="text-xs text-slate-500">{item.category} • {item.payment_method} • {formatDateShort(item.occurred_at || item.created_date)}</p></div><div className={`font-bold ${item.type === 'entry' ? 'text-emerald-700' : 'text-red-700'}`}>{item.type === 'entry' ? '+' : '-'} {formatBRL(item.amount)}</div><Button type="button" variant="ghost" size="icon" onClick={() => openDetails(item)} title="Visualizar lançamento"><Eye className="w-4 h-4 text-slate-600" /></Button>{item.type === 'expense' && <div className="flex items-center gap-1 ml-auto"><Button type="button" variant="ghost" size="icon" disabled={Boolean(item.reference_type)} onClick={() => startEditing(item)} title={item.reference_type ? 'Edite pela tela de Compras' : 'Editar despesa'}><Pencil className="w-4 h-4" /></Button><Button type="button" variant="ghost" size="icon" disabled={Boolean(item.reference_type)} onClick={() => deleteExpense(item)} title={item.reference_type ? 'Exclua pela tela de Compras' : 'Excluir despesa'}><Trash2 className="w-4 h-4 text-red-600" /></Button></div>}</div>)}</div>}
      </div>

      <Dialog open={Boolean(selectedTransaction)} onOpenChange={open => { if (!open) { setSelectedTransaction(null); setRelatedRecord(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedTransaction && <>
            <DialogHeader><DialogTitle>Detalhes do lançamento</DialogTitle></DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><p className="text-xs text-slate-400">Descrição</p><p className="font-medium text-slate-900">{selectedTransaction.description}</p></div>
                <div><p className="text-xs text-slate-400">Tipo</p><p className={selectedTransaction.type === 'entry' ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{selectedTransaction.type === 'entry' ? 'Entrada' : 'Saída'}</p></div>
                <div><p className="text-xs text-slate-400">Valor total</p><p className="text-lg font-bold text-slate-900">{formatBRL(selectedTransaction.amount)}</p></div>
                {Number(selectedTransaction.fee_amount || 0) > 0 && <><div><p className="text-xs text-slate-400">Valor bruto</p><p className="text-slate-700">{formatBRL(selectedTransaction.gross_amount)}</p></div><div><p className="text-xs text-slate-400">Taxa descontada</p><p className="font-medium text-red-700">- {formatBRL(selectedTransaction.fee_amount)}</p></div></>}
                <div><p className="text-xs text-slate-400">Data</p><p className="text-slate-700">{formatDate(selectedTransaction.occurred_at || selectedTransaction.created_date)}</p></div>
                <div><p className="text-xs text-slate-400">Forma de pagamento</p><p className="text-slate-700">{selectedTransaction.payment_method}</p></div>
                <div><p className="text-xs text-slate-400">Divisão do saldo</p><p className="text-slate-700">Físico: {formatBRL(selectedTransaction.cash_amount)} • Digital: {formatBRL(selectedTransaction.digital_amount)}</p></div>
              </div>
              {detailLoading && <p className="text-slate-500">Carregando dados vinculados...</p>}
              {relatedRecord && selectedTransaction.reference_type === 'order' && <div className="space-y-3 border-t border-slate-100 pt-4"><h3 className="font-semibold text-slate-900">Pedido {relatedRecord.invoice_number || ''}</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><p><span className="text-slate-400">Cliente:</span> {relatedRecord.restaurant_name}</p><p><span className="text-slate-400">Status:</span> {relatedRecord.status}</p><p className="sm:col-span-2"><span className="text-slate-400">Atendimento:</span> {relatedRecord.delivery_type === 'pickup' ? 'RETIRADA EM LOJA' : relatedRecord.delivery_address}</p><p><span className="text-slate-400">Pagamento:</span> {relatedRecord.payment_method_2 ? `${relatedRecord.payment_method} + ${relatedRecord.payment_method_2}` : relatedRecord.payment_method}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 font-medium">Itens</p>{getOrderDisplayItems(relatedRecord).map((item, index) => <div key={index} className="flex justify-between"><span>{getOrderItemQuantityLabel(item)} {item.product_name}</span><span>{formatBRL(getOrderItemSubtotal(item))}</span></div>)}</div>{relatedRecord.delivery_photo_url && <img src={relatedRecord.delivery_photo_url} alt="Comprovante" className="h-32 w-32 rounded-lg border border-slate-200 object-cover" />}</div>}
              {relatedRecord && selectedTransaction.reference_type === 'purchase' && <div className="space-y-3 border-t border-slate-100 pt-4"><h3 className="font-semibold text-slate-900">Compra vinculada</h3><p><span className="text-slate-400">Fornecedor:</span> {relatedRecord.supplier_name}</p><p><span className="text-slate-400">Nota:</span> {relatedRecord.invoice_number}</p><p><span className="text-slate-400">Data:</span> {formatDateShort(relatedRecord.date)}</p>{Array.isArray(relatedRecord.products) && <div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 font-medium">Produtos</p>{relatedRecord.products.map((product, index) => <div key={index} className="flex justify-between"><span>{product.product_name}</span><span>{product.quantity} • {formatBRL(product.price)}</span></div>)}</div>}</div>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
