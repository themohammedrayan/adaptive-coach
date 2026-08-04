import { Text, View } from 'react-native';
import { formatMoneyMinor } from '../../../finance/money';
import { ProgressBar, Row } from '../../kit';
import { space, type, useTheme } from '../../theme';

/**
 * How much of a credit limit is used. Shared by Accounts and Debt so the 80%
 * warning threshold is defined once.
 */
export function CreditUtilization({
  usedMinor,
  limitMinor,
  currency,
}: {
  usedMinor: number;
  limitMinor: number;
  currency: string;
}) {
  const t = useTheme();
  const pct = limitMinor > 0 ? usedMinor / limitMinor : 0;
  return (
    <View style={{ gap: space.xs }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[type.caption, { color: t.muted }]}>
          Used {formatMoneyMinor(usedMinor, currency)} of {formatMoneyMinor(limitMinor, currency)}
        </Text>
        <Text style={[type.caption, { color: pct > 0.8 ? t.danger : t.muted }]}>{Math.round(pct * 100)}%</Text>
      </Row>
      <ProgressBar pct={pct} color={pct > 0.8 ? t.danger : t.accent} />
    </View>
  );
}
