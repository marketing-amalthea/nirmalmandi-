/**
 * OTP Login Screen — entry point for both buyers and sellers.
 * Phone input → OTP input → role check → route to appropriate flow.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme/tokens';
import { authApi } from '../services/api';
import { useAppStore } from '../store';

interface Props {
  navigation: any;
}

export function OtpScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const setAuth = useAppStore(s => s.setAuth);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<TextInput>(null);

  async function sendOtp() {
    if (phone.length < 10) { Alert.alert('Invalid phone'); return; }
    setLoading(true);
    try {
      const formatted = phone.startsWith('+91') ? phone : `+91${phone.replace(/^0/, '')}`;
      await authApi.sendOtp(formatted);
      setPhone(formatted);
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (otp.length !== 6) { Alert.alert('Enter 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, otp);
      const { accessToken, refreshToken, registered, role, userId } = res.data.data;

      if (!registered) {
        navigation.navigate('Register', { phone, accessToken });
        return;
      }

      setAuth(
        { userId, phone, role },
        accessToken,
        refreshToken
      );

      navigation.replace(role === 'seller' ? 'SellerHome' : 'BuyerHome');
    } catch (e: any) {
      Alert.alert('Invalid OTP', 'Please try again');
      setOtp('');
    } finally { setLoading(false); }
  }

  const s = makeStyles(colors, isDark);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.card}>
        {/* Logo */}
        <View style={s.logoArea}>
          <Text style={s.logo}>NirmalMandi</Text>
          <Text style={s.tagline}>निर्मल स्टॉक। निर्मल डील्स।</Text>
        </View>

        {step === 'phone' ? (
          <>
            <Text style={s.label}>Mobile Number</Text>
            <View style={s.inputWrapper}>
              <Text style={s.prefix}>+91</Text>
              <TextInput
                style={s.input}
                value={phone.replace('+91', '')}
                onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="Enter mobile number"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={sendOtp}
              />
            </View>
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={sendOtp}
              disabled={loading || phone.length < 10}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Send OTP</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.label}>OTP sent to {phone}</Text>
            <TextInput
              ref={otpRef}
              style={[s.input, s.otpInput]}
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="______"
              placeholderTextColor={colors.muted}
              textAlign="center"
            />
            <TouchableOpacity
              style={[s.btn, (loading || otp.length !== 6) && s.btnDisabled]}
              onPress={verifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Verify OTP</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }} style={s.link}>
              <Text style={s.linkText}>Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={s.footer}>
        By continuing, you agree to our Terms & Privacy Policy
      </Text>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: typeof Colors.light, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing[4],
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing[8],
      width: '100%',
      maxWidth: 360,
      ...Shadow.lg,
    },
    logoArea: { alignItems: 'center', marginBottom: Spacing[8] },
    logo: {
      fontSize: Typography['2xl'],
      fontWeight: Typography.bold,
      color: Colors.primary,
    },
    tagline: {
      fontSize: Typography.sm,
      color: colors.muted,
      marginTop: Spacing[1],
    },
    label: {
      fontSize: Typography.sm,
      fontWeight: Typography.medium,
      color: colors.textSecondary,
      marginBottom: Spacing[2],
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      marginBottom: Spacing[4],
      overflow: 'hidden',
    },
    prefix: {
      paddingHorizontal: Spacing[3],
      paddingVertical: Spacing[4],
      backgroundColor: colors.surfaceAlt,
      color: colors.textSecondary,
      fontSize: Typography.base,
      fontWeight: Typography.medium,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    input: {
      flex: 1,
      paddingHorizontal: Spacing[4],
      paddingVertical: Spacing[4],
      color: colors.text,
      fontSize: Typography.base,
    },
    otpInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      marginBottom: Spacing[4],
      fontSize: Typography['2xl'],
      fontWeight: Typography.bold,
      letterSpacing: 16,
      color: colors.text,
      paddingVertical: Spacing[4],
    },
    btn: {
      backgroundColor: Colors.primary,
      borderRadius: Radius.md,
      paddingVertical: Spacing[4],
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    btnText: {
      color: '#fff',
      fontSize: Typography.base,
      fontWeight: Typography.semibold,
    },
    link: { alignItems: 'center', marginTop: Spacing[4] },
    linkText: { color: Colors.primary, fontSize: Typography.sm },
    footer: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: Typography.xs,
      textAlign: 'center',
      marginTop: Spacing[6],
    },
  });
}
