import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { AppButton, Card, Field } from './kit';
import { space, type, useTheme } from './theme';

export function SignIn() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    setBusy(false);
  };

  const signUp = async () => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else if (!data.session) setMessage('Account created — check your email to confirm, then sign in.');
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
          <Text style={[styles.markText, { color: t.accent }]}>AC</Text>
        </View>
        <Text style={[type.title, { color: t.ink }]}>Adaptive Coach</Text>
        <Text style={[type.caption, { color: t.secondary, textAlign: 'center' }]}>
          Your daily calories and macros, self-correcting from your real weight trend.
        </Text>
      </View>

      <Card style={styles.card}>
        <Field
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <AppButton title="Sign in" onPress={signIn} busy={busy} />
        <AppButton title="Create account" onPress={signUp} variant="ghost" disabled={busy} />
        {message !== null && (
          <Text style={[type.caption, { color: t.warning, textAlign: 'center' }]}>{message}</Text>
        )}
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  brand: { alignItems: 'center', gap: space.s },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  markText: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  card: { gap: space.m },
});
