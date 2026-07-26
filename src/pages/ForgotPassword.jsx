import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import PasswordInput from "@/components/ui/password-input";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [step, setStep] = useState('email'); // 'email' | 'code' | 'newPassword' | 'done'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
      setStep('code');
    } catch (err) {
      // Não revela se o e-mail existe ou não, por segurança — mas ainda assim avança
      setStep('code');
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setError("");
    setLoading(true);
    try {
      await base44.auth.verifyRecoveryOtp({ email, code });
      setStep('newPassword');
    } catch (err) {
      setError(err.message || "Código inválido ou expirado");
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {}
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.setNewPassword(newPassword);
      setStep('done');
      setTimeout(() => { window.location.href = "/login"; }, 1800);
    } catch (err) {
      setError(err.message || "Falha ao redefinir a senha");
    }
    setLoading(false);
  };

  if (step === 'code') {
    return (
      <AuthLayout
        icon={KeyRound}
        title="Digite o código"
        subtitle={`Enviamos um código de 8 dígitos para ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={8} value={code} onChange={setCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
              <InputOTPSlot index={4} /><InputOTPSlot index={5} /><InputOTPSlot index={6} /><InputOTPSlot index={7} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleVerifyCode} disabled={loading || code.length < 8}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : "Verificar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Não recebeu o código?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Reenviar</button>
        </p>
      </AuthLayout>
    );
  }

  if (step === 'newPassword') {
    return (
      <AuthLayout icon={KeyRound} title="Nova senha" subtitle="Digite sua nova senha abaixo">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput id="password" autoComplete="new-password" autoFocus placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <PasswordInput id="confirm" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12" required />
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Alterando...</> : "Alterar Senha"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  if (step === 'done') {
    return (
      <AuthLayout icon={KeyRound} title="Senha alterada!" subtitle="Redirecionando para o login...">
        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Mail}
      title="Redefinir senha"
      subtitle="Vamos te enviar um código para redefini-la"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Voltar para o login
        </Link>
      }
    >
      <form onSubmit={handleSendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : "Enviar código"}
        </Button>
      </form>
    </AuthLayout>
  );
}
