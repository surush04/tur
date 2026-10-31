import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as api from '../api';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useGo, type ReturnTarget } from '../nav';
import { readStore, writeStore } from '../store';
import { colors } from '../theme';
import { Button, Field, Frame, Muted, Notice, Title } from '../ui';

function fail(error: unknown) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Error';
}

export function SplashScreen() {
  const { ready } = useAuth();
  const { t } = useI18n();
  const go = useGo();
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void readStore('rohi_onboarded').then((seen) => go.replace(seen === '1' ? 'Main' : 'Onboarding'));
    }, 900);
    return () => clearTimeout(timer);
  }, [ready, go]);
  return (
    <Frame>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 480, gap: 8 }}>
        <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('brand.name')}</Text>
        <Title>{t('brand.name')}</Title>
        <Muted>{t('splash.line')}</Muted>
      </View>
    </Frame>
  );
}

export function OnboardingScreen() {
  const { t } = useI18n();
  const go = useGo();
  const start = () => {
    void writeStore('rohi_onboarded', '1');
    go.replace('Main');
  };
  return (
    <Frame>
      <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('brand.name')}</Text>
      <Title>{t('home.discover')}</Title>
      <Muted>{t('onb.1')}</Muted>
      <Muted>{t('onb.2')}</Muted>
      <Muted>{t('onb.3')}</Muted>
      <Button label={t('onb.start')} onPress={start} />
      <Button label={t('onb.skip')} ghost onPress={start} />
    </Frame>
  );
}

export function LoginScreen() {
  const { t } = useI18n();
  const { login } = useAuth();
  const go = useGo();
  const route = useRoute();
  const returnTo = (route.params as { returnTo?: ReturnTarget } | undefined)?.returnTo;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      if (returnTo) go.replace(returnTo.name, returnTo.params);
      else go.replace('Main');
    } catch (reason) {
      setError(fail(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => go.back()} />
      <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('brand.name')}</Text>
      <Title>{t('auth.login')}</Title>
      <Muted>{t('auth.loginLead')}</Muted>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboard="email-address" />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secure />
      <Muted>{t('auth.passwordHint')}</Muted>
      <Button label={t('auth.forgot')} ghost onPress={() => go.go('Forgot', { returnTo })} />
      {error ? <Notice text={error} error /> : null}
      <Button label={t('auth.login')} onPress={() => void submit()} disabled={busy || !email.includes('@') || password.length < 4} />
      <Button label={t('auth.register')} ghost onPress={() => go.go('Register', { returnTo })} />
    </Frame>
  );
}

export function RegisterScreen() {
  const { t, lang } = useI18n();
  const { register, setUser } = useAuth();
  const go = useGo();
  const route = useRoute();
  const returnTo = (route.params as { returnTo?: ReturnTarget } | undefined)?.returnTo;
  const [kind, setKind] = useState<'' | 'traveler' | 'company'>('');
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pinOk = /^\d{4}$/.test(password);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await register({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim(), language: lang });
      if (kind === 'company') {
        setUser(await api.setMode('owner'));
        go.replace('Owner');
        return;
      }
      if (returnTo) go.replace(returnTo.name, returnTo.params);
      else go.replace('Main');
    } catch (reason) {
      setError(fail(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Button label={t('common.back')} ghost onPress={() => (kind ? setKind('') : go.back())} />
      <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('brand.name')}</Text>
      {kind === '' ? (
        <>
          <Title>{t('auth.register')}</Title>
          <Muted>{t('auth.kindLead')}</Muted>
          <Button label={t('auth.traveler')} onPress={() => setKind('traveler')} />
          <Muted>{t('auth.travelerLead')}</Muted>
          <Button label={t('auth.company')} onPress={() => setKind('company')} />
          <Muted>{t('auth.companyLead')}</Muted>
        </>
      ) : (
        <>
          <Title>{t(kind === 'company' ? 'auth.company' : 'auth.traveler')}</Title>
          <Muted>{t(kind === 'company' ? 'auth.companyForm' : 'auth.registerLead')}</Muted>
          <Field label={t(kind === 'company' ? 'auth.companyName' : 'auth.first')} value={firstName} onChangeText={setFirst} />
          <Field label={t(kind === 'company' ? 'auth.yourName' : 'auth.last')} value={lastName} onChangeText={setLast} />
          <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboard="email-address" />
          <Field label={t('auth.password')} value={password} onChangeText={(value) => setPassword(value.replace(/\D/g, '').slice(0, 4))} secure keyboard="number-pad" maxLength={4} />
          <Muted>{t('auth.passwordHint')}</Muted>
          {error ? <Notice text={error} error /> : null}
          <Button label={t('auth.register')} onPress={() => void submit()} disabled={busy || !pinOk || !email.includes('@') || !firstName.trim() || !lastName.trim()} />
        </>
      )}
      <Button label={t('auth.login')} ghost onPress={() => go.go('Login', { returnTo })} />
    </Frame>
  );
}

export function ForgotScreen() {
  const { t } = useI18n();
  const go = useGo();
  const route = useRoute();
  const preset = (route.params as { email?: string } | undefined)?.email ?? '';
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState(preset);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [dev, setDev] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (step === 'email') {
        const response = await api.forgot(email.trim());
        setMessage(response.message);
        setDev(response.devResetToken ?? '');
        if (response.devResetToken) setToken(response.devResetToken);
        setStep('reset');
        return;
      }
      await api.resetPassword(token.trim(), password);
      setMessage(t('auth.updated'));
      setStep('done');
    } catch (reason) {
      setError(fail(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Button label={t('auth.login')} ghost onPress={() => go.go('Login')} />
      <Title>{t('auth.forgot')}</Title>
      <Muted>{t(step === 'reset' ? 'auth.resetLead' : 'auth.forgotLead')}</Muted>
      {step === 'done' ? (
        <>
          <Notice text={message} />
          <Button label={t('auth.login')} onPress={() => go.replace('Login')} />
        </>
      ) : (
        <>
          {step === 'email' ? <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboard="email-address" /> : null}
          {step === 'reset' ? (
            <>
              {message ? <Notice text={message} /> : null}
              {dev ? <Notice text={`${t('auth.dev')} ${dev}`} /> : null}
              <Field label={t('auth.code')} value={token} onChangeText={setToken} />
              <Field label={t('auth.newPin')} value={password} onChangeText={(value) => setPassword(value.replace(/\D/g, '').slice(0, 4))} secure keyboard="number-pad" maxLength={4} />
            </>
          ) : null}
          {error ? <Notice text={error} error /> : null}
          <Button
            label={t(step === 'email' ? 'auth.send' : 'auth.reset')}
            onPress={() => void submit()}
            disabled={busy || (step === 'email' ? !email.includes('@') : token.trim().length < 20 || !/^\d{4}$/.test(password))}
          />
        </>
      )}
    </Frame>
  );
}
