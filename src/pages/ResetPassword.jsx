import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/supabaseClient"; // Ajuste conforme o seu client do supabase
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, KeyRound, Mail } from "lucide-react";
import PasswordInput from "@/components/ui/password-input";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [step, setStep] = useState(1); // Passo 1: Informar e-mail e código | Passo 2: Nova senha
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Etapa 1: Validar o código de 8 dígitos inserido pelo usuário
  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !token) {
      setError("Por favor, preencha o e-mail e o código de verificação.");
      return;
    }
    setLoading(true);
    try {
      // O Supabase verifica o token de recuperação (OTP)
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: token.trim(),
        type: "recovery",
      });

      if (error) throw error;

      // Se o código estiver correto, avança para a tela de digitar a nova senha
      setStep(2);
    } catch (err) {
      setError(err.message || "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  // Etapa 2: Atualizar para a nova senha
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Sucesso! Redireciona para o login
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Falha ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={step === 1 ? KeyRound : Lock}
      title={step === 1 ? "Digite o código" : "Nova senha"}
      subtitle={
        step === 1
          ? "Insira seu e-mail e o código de 8 dígitos recebido"
          : "Crie uma nova senha segura para sua conta"
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {step === 1 ? (
        // FORMULÁRIO PASSO 1: E-mail e Código de 8 dígitos
        <form onSubmit={handleVerifyToken} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Código de 8 dígitos</Label>
            <Input
              id="token"
              type="text"
              maxLength={8}
              placeholder="00000000"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-12 text-center tracking-widest text-lg font-bold"
              required
            />
          </div>

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar código"
            )}
          </Button>

          <div className="text-center mt-4">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Não recebeu o código? Solicitar novamente
            </Link>
          </div>
        </form>
      ) : (
        // FORMULÁRIO PASSO 2: Nova Senha e Confirmação
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redefinindo...
              </>
            ) : (
              "Salvar nova senha"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}