import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { store } from '../services/store';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  MapPin, 
  Briefcase, 
  Search, 
  Star, 
  Loader2, 
  Check, 
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';
import { validateEmail, validatePassword } from '../utils/security';
import { logSecurityWarning, logSecurityError, logSecurityEvent } from '../services/audit';

const Login: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('tab') === 'register' || searchParams.get('mode') === 'register';
  const initialRole = searchParams.get('role') === 'provider' ? UserRole.PROVIDER : UserRole.CLIENT;

  const [isRegistering, setIsRegistering] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal / Estado de recuperação de senha
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, login, register, loading: authLoading } = useAuth();

  // Sincroniza parâmetros de URL com o estado da página
  useEffect(() => {
    if (searchParams.get('tab') === 'register' || searchParams.get('mode') === 'register') {
      setIsRegistering(true);
    }
    if (searchParams.get('role') === 'provider') {
      setRole(UserRole.PROVIDER);
    }
  }, [searchParams]);

  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-sm font-medium text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Cálculos de força de senha interativa
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const passedChecksCount = [hasMinLength, hasUpperCase, hasNumber, hasSpecial].filter(Boolean).length;
  
  const getPasswordStrengthLabel = () => {
    if (!password) return { label: '', color: 'bg-gray-200', text: 'text-gray-400', width: 'w-0' };
    if (passedChecksCount <= 1) return { label: 'Fraca', color: 'bg-rose-500', text: 'text-rose-600', width: 'w-1/4' };
    if (passedChecksCount === 2) return { label: 'Razoável', color: 'bg-amber-500', text: 'text-amber-600', width: 'w-2/4' };
    if (passedChecksCount === 3) return { label: 'Boa', color: 'bg-blue-500', text: 'text-blue-600', width: 'w-3/4' };
    return { label: 'Forte & Segura', color: 'bg-emerald-500', text: 'text-emerald-600', width: 'w-full' };
  };

  const strength = getPasswordStrengthLabel();

  const handleTabChange = (registerTab: boolean) => {
    setIsRegistering(registerTab);
    setErrorMsg('');
    setSearchParams(registerTab ? { tab: 'register' } : { tab: 'login' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validação de E-mail
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setErrorMsg(emailValidation.message || 'Por favor, insira um e-mail válido.');
      logSecurityWarning('login.invalid_email', 'Tentativa com e-mail inválido', { email });
      return;
    }

    // Validação de Senha básica
    if (!password) {
      setErrorMsg('Por favor, informe sua senha.');
      return;
    }

    if (isRegistering) {
      if (!name.trim()) {
        setErrorMsg('Por favor, informe seu nome completo.');
        return;
      }

      if (!acceptTerms) {
        setErrorMsg('Você precisa concordar com os Termos de Uso e Política de Privacidade para continuar.');
        return;
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        setErrorMsg(passwordValidation.message || 'A senha não atende aos requisitos de segurança.');
        logSecurityWarning('login.password_policy', 'Senha fora da política de segurança', { email });
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegistering) {
        await register(email, password, name.trim(), role);
        logSecurityEvent('auth.register', 'Nova conta criada com sucesso', { email, role }, undefined);
        toast('🎉 Cadastro realizado com sucesso!', 'success');
        
        if (role === UserRole.PROVIDER) {
          toast('Complete as informações do seu perfil para anunciar seus serviços.', 'info');
          navigate('/profile/edit');
        } else {
          navigate('/dashboard');
        }
      } else {
        await login(email, password);
        logSecurityEvent('auth.login', 'Login realizado com sucesso', { email }, undefined);
        toast('Bem-vindo de volta ao Mestrio!', 'success');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error(error);
      logSecurityError('auth.failed', 'Falha na autenticação', { email, action: isRegistering ? 'register' : 'login' }, undefined);
      
      let friendlyError = 'Não foi possível completar a operação. Verifique suas credenciais.';
      const rawError = error.message?.toLowerCase() || '';

      if (rawError.includes('invalid login credentials') || rawError.includes('invalid_credentials')) {
        friendlyError = 'E-mail ou senha incorretos. Verifique os dados digitados.';
      } else if (rawError.includes('user already registered') || rawError.includes('already registered')) {
        friendlyError = 'Este endereço de e-mail já está cadastrado. Faça login ou recupere sua senha.';
      } else if (rawError.includes('password should be at least') || rawError.includes('weak password')) {
        friendlyError = 'A senha precisa ter pelo menos 8 caracteres com letras e números.';
      } else if (rawError.includes('rate limit') || rawError.includes('too many requests')) {
        friendlyError = 'Muitas tentativas em pouco tempo. Por segurança, aguarde alguns minutos.';
      } else if (rawError.includes('invalid email')) {
        friendlyError = 'Formato de e-mail inválido.';
      }
      
      setErrorMsg(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailVal = validateEmail(forgotEmail);
    if (!emailVal.valid) {
      toast(emailVal.message || 'Informe um e-mail válido.', 'error');
      return;
    }

    setSendingReset(true);
    try {
      await store.requestPasswordReset(forgotEmail);
      setResetSentSuccess(true);
      toast('Enviamos o link de recuperação para seu e-mail!', 'success');
    } catch (err: any) {
      console.error(err);
      toast('Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Container Principal Centralizado com Layout Dividido */}
      <div className="max-w-5xl w-full mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* ============================================================ */}
        {/* COLUNA ESQUERDA: Showcase & Benefícios do Mestrio (lg:col-span-5) */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Elementos visuais decorativos de fundo */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-56 h-56 bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-60 h-60 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10">
            {/* Logo do Mestrio */}
            <Link to="/" className="inline-flex items-center gap-2 group mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">Mestrio</span>
            </Link>

            {/* Badge de Lançamento */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>100% Gratuito &bull; Sem Taxas de Adesão</span>
            </div>

            {/* Título & Descrição */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug mb-4">
              {isRegistering 
                ? 'Junte-se à maior rede de serviços locais da sua região.' 
                : 'Acesse seu painel e impulsione suas conexões.'}
            </h1>
            
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              Conectamos clientes que precisam de soluções rápidas a profissionais autônomos verificados e qualificados.
            </p>

            {/* Lista de Diferenciais / Vantagens */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Profissionais Verificados</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Avaliações 100% reais de clientes auditados e histórico comprovado.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Busca por Proximidade</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Encontre prestadores no seu bairro com cálculo de distância em tempo real.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Contato Direto no WhatsApp</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Orçamentos rápidos sem burocracia ou taxas de intermediação.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé da Coluna Esquerda com Prova Social */}
          <div className="relative z-10 pt-8 border-t border-white/10 mt-8 flex items-center justify-between">
            <div className="flex items-center gap-1 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
              <Star className="w-4 h-4 fill-amber-400" />
              <Star className="w-4 h-4 fill-amber-400" />
              <Star className="w-4 h-4 fill-amber-400" />
              <Star className="w-4 h-4 fill-amber-400" />
              <span className="text-xs font-bold text-white ml-1.5">4.9 / 5.0</span>
            </div>
            <span className="text-xs text-slate-400">+1.200 serviços realizados</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLUNA DIREITA: Formulário Interativo de Login / Cadastro (lg:col-span-7) */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          
          {/* Seletor Segmentado de Abas (Entrar / Criar Conta) */}
          <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8 max-w-sm mx-auto w-full">
            <button
              type="button"
              onClick={() => handleTabChange(false)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
                !isRegistering 
                  ? 'bg-white text-brand-700 shadow-xs shadow-slate-200' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => handleTabChange(true)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
                isRegistering 
                  ? 'bg-white text-brand-700 shadow-xs shadow-slate-200' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Cabeçalho do Formulário */}
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {isRegistering ? 'Crie sua conta no Mestrio' : 'Bem-vindo de volta!'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isRegistering 
                ? 'Leva menos de 1 minuto para começar a usar a plataforma.' 
                : 'Insira suas credenciais para acessar sua conta.'}
            </p>
          </div>

          {/* Alerta de Erro Visual */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
              <button 
                type="button" 
                onClick={() => setErrorMsg('')}
                className="text-rose-400 hover:text-rose-700 p-0.5 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Formulário Principal */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* ETAPA DE CADASTRO: Seleção de Tipo de Conta */}
            {isRegistering && (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Como você deseja utilizar o Mestrio?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Opção Cliente */}
                  <div
                    onClick={() => setRole(UserRole.CLIENT)}
                    className={`cursor-pointer border-2 rounded-2xl p-3.5 transition-all flex items-center gap-3 relative ${
                      role === UserRole.CLIENT 
                        ? 'border-brand-600 bg-brand-50/60 shadow-xs ring-1 ring-brand-600/20' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      role === UserRole.CLIENT ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Search className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 leading-tight">Quero Contratar</div>
                      <div className="text-xs text-slate-500 mt-0.5">Buscar serviços e orçamentos</div>
                    </div>
                    {role === UserRole.CLIENT && (
                      <div className="absolute top-2.5 right-2.5 text-brand-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Opção Profissional */}
                  <div
                    onClick={() => setRole(UserRole.PROVIDER)}
                    className={`cursor-pointer border-2 rounded-2xl p-3.5 transition-all flex items-center gap-3 relative ${
                      role === UserRole.PROVIDER 
                        ? 'border-brand-600 bg-brand-50/60 shadow-xs ring-1 ring-brand-600/20' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      role === UserRole.PROVIDER ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 leading-tight">Quero Trabalhar</div>
                      <div className="text-xs text-slate-500 mt-0.5">Anunciar meus serviços</div>
                    </div>
                    {role === UserRole.PROVIDER && (
                      <div className="absolute top-2.5 right-2.5 text-brand-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>

                {role === UserRole.PROVIDER && (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-brand-600 shrink-0" />
                    Você poderá publicar anúncios, gerenciar orçamentos e receber avaliações com selo de verificação.
                  </p>
                )}
              </div>
            )}

            {/* ETAPA DE CADASTRO: Nome Completo */}
            {isRegistering && (
              <div>
                <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={isRegistering}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            {/* Campo E-mail */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Senha
                </label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                      setResetSentSuccess(false);
                    }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegistering ? 'Mínimo 8 caracteres com maiúscula e número' : '••••••••'}
                  className="block w-full pl-10 pr-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicador de Força de Senha (Somente no Cadastro) */}
              {isRegistering && password && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Força da senha:</span>
                    <span className={`font-bold ${strength.text}`}>{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}></div>
                  </div>

                  {/* Checklist Dinâmico de Requisitos */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5 shrink-0" /> 8+ caracteres
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5 shrink-0" /> Letra maiúscula
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5 shrink-0" /> Número
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3.5 h-3.5 shrink-0" /> Símbolo (!@#$)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA DE CADASTRO: Confirmação de Senha */}
            {isRegistering && (
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required={isRegistering}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="block w-full pl-10 pr-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-rose-500 mt-1 font-medium">As senhas não coincidem.</p>
                )}
              </div>
            )}

            {/* Checkbox: Lembrar de mim (Login) / Concordar com Termos (Cadastro) */}
            {!isRegistering ? (
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-600 select-none cursor-pointer">
                  Manter conectado neste dispositivo
                </label>
              </div>
            ) : (
              <div className="flex items-start">
                <input
                  id="accept-terms"
                  name="accept-terms"
                  type="checkbox"
                  required
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="h-4 w-4 mt-0.5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="accept-terms" className="ml-2 block text-xs text-slate-600 select-none leading-relaxed">
                  Li e concordo com os{' '}
                  <Link to="/terms" target="_blank" className="font-bold text-brand-600 hover:underline">
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link to="/privacy" target="_blank" className="font-bold text-brand-600 hover:underline">
                    Política de Privacidade
                  </Link>{' '}
                  do Mestrio.
                </label>
              </div>
            )}

            {/* Botão de Envio Principal */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-600/25 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <span>{isRegistering ? 'Criar Minha Conta Gratuita' : 'Acessar Minha Conta'}</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Troca Rápida de Modo no Rodapé do Form */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              {isRegistering ? 'Já possui uma conta cadastrada?' : 'Ainda não tem uma conta no Mestrio?'}
              <button
                type="button"
                onClick={() => handleTabChange(!isRegistering)}
                className="ml-1.5 font-bold text-brand-600 hover:text-brand-800 hover:underline inline-flex items-center"
              >
                {isRegistering ? 'Fazer login' : 'Cadastre-se gratuitamente'}
              </button>
            </p>
          </div>

          {/* Selo de Segurança */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ambiente seguro com criptografia SSL 256-bit</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: Recuperação de Senha */}
      {/* ============================================================ */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Recuperar sua senha</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Digite o e-mail cadastrado na sua conta. Enviaremos um link seguro para você redefinir sua senha.
            </p>

            {resetSentSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-900">E-mail enviado com sucesso!</p>
                    <p className="mt-1">Confira sua caixa de entrada e siga as instruções para criar uma nova senha.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Seu E-mail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReset}
                    className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {sendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
