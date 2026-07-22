import React, { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskPhone, maskCNPJ, maskCEP } from '@/lib/masks';
import { Fish, Loader2, Mail, Lock, KeyRound, Store, Phone, MapPin, FileText } from 'lucide-react';

export default function AuthModal({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [contact, setContact] = useState('');
  const [street, setStreet] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [accountName, setAccountName] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      if (onSuccess) onSuccess();
      else window.location.href = '/';
    } catch {
      setError('Email ou senha inválidos.');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await base44.auth.register({ email, password });
      setStep('otp');
    } catch {
      setError('Não foi possível registrar. Verifique os dados.');
    }
    setLoading(false);
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await base44.auth.verifyOtp({ email, otpCode: otp });
      if (res?.access_token) {
        try { base44.auth.setToken(res.access_token); } catch {}
      }
      setStep('profile');
    } catch {
      setError('Código inválido.');
    }
    setLoading(false);
  };

  const handleProfile = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const user = await base44.auth.me();
      const fullAddr = [street, neighborhood, city, stateVal, zipCode].filter(Boolean).join(', ');
      await base44.entities.Restaurant.create({
        restaurant_name: restaurantName,
        cnpj,
        contact_number: contact,
        street,
        neighborhood,
        city,
        state: stateVal,
        zip_code: zipCode,
        address: fullAddr,
        account_name: accountName || restaurantName,
        user_id: user.id,
      });
      if (onSuccess) onSuccess();
      else window.location.href = '/loja';
    } catch {
      setError('Erro ao salvar. Tente fazer login novamente.');
    }
    setLoading(false);
  };

  const titles = { login: 'Entrar', register: 'Criar Conta', otp: 'Verificação', profile: 'Dados do Restaurante' };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Fish className="w-5 h-5 text-white" />
            </div>
            <DialogTitle>{titles[step]}</DialogTitle>
          </div>
        </DialogHeader>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="seu@email.com" />
              </div>
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="pl-9" placeholder="••••••" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Entrar'}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Não tem conta?{' '}
              <button type="button" onClick={() => { setStep('register'); setError(''); }} className="text-emerald-600 font-medium">Cadastre-se</button>
            </p>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="seu@email.com" />
              </div>
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="pl-9" placeholder="••••••" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Cadastrar'}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Já tem conta?{' '}
              <button type="button" onClick={() => { setStep('login'); setError(''); }} className="text-emerald-600 font-medium">Entrar</button>
            </p>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtp} className="space-y-4">
            <p className="text-sm text-slate-500">Enviamos um código de verificação para <strong>{email}</strong></p>
            <div>
              <Label>Código de Verificação</Label>
              <div className="relative mt-1">
                <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input required value={otp} onChange={e => setOtp(e.target.value)} className="pl-9 text-center text-lg tracking-widest" placeholder="000000" maxLength={6} />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Verificar'}
            </Button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleProfile} className="space-y-3">
            <div>
              <Label>Nome do Restaurante *</Label>
              <div className="relative mt-1">
                <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input required value={restaurantName} onChange={e => setRestaurantName(e.target.value)} className="pl-9" placeholder="Restaurante Exemplo" />
              </div>
            </div>
            <div>
              <Label>CNPJ</Label>
              <div className="relative mt-1">
                <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} className="pl-9" placeholder="00.000.000/0000-00" />
              </div>
            </div>
            <div>
              <Label>Telefone / Contato *</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input required value={contact} onChange={e => setContact(maskPhone(e.target.value))} className="pl-9" placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div>
              <Label>CEP *</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input required value={zipCode} onChange={e => setZipCode(maskCEP(e.target.value))} className="pl-9" placeholder="00000-000" />
              </div>
            </div>
            <div>
              <Label>Rua *</Label>
              <Input required value={street} onChange={e => setStreet(e.target.value)} className="mt-1" placeholder="Rua / Avenida" />
            </div>
            <div>
              <Label>Bairro *</Label>
              <Input required value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cidade *</Label>
                <Input required value={city} onChange={e => setCity(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Estado *</Label>
                <Input required value={stateVal} onChange={e => setStateVal(e.target.value.toUpperCase().slice(0, 2))} className="mt-1" placeholder="SP" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Finalizar Cadastro'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}