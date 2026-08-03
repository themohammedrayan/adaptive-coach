import { Text, View } from 'react-native';
import type { CycleStatus, DebtLine } from '../../../finance/debt';
import { formatMoneyMinor } from '../../../finance/money';
import { formatDayLabel } from '../../../finance/periods';
import { Card, Row } from '../../kit';
import { radius, space, type, useTheme, type Theme } from '../../theme';
import { CreditUtilization } from './CreditUtilization';

const STATUS_LABEL: Record<CycleStatus, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  unpaid: 'Unpaid',
  no_minimum: 'No minimum set',
};

function statusColor(t: Theme, status: CycleStatus): string {
  if (status === 'paid') return t.good;
  if (status === 'partial') return t.warning;
  if (status === 'unpaid') return t.danger;
  return t.muted;
}

export function DebtLineCard({ line, payFirst }: { line: DebtLine; payFirst: boolean }) {
  const t = useTheme();
  const currency = line.account.currency;
  const cleared = line.balanceMinor <= 0;

  return (
    <Card style={{ gap: space.s }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={space.s}>
          <Text style={[type.heading, { color: t.ink }]}>{line.account.name}</Text>
          {payFirst && (
            <View style={[styles.badge, { backgroundColor: t.accentSoft }]}>
              <Text style={[type.caption, { color: t.accent, fontWeight: '700' }]}>PAY FIRST</Text>
            </View>
          )}
        </Row>
        <Text style={[type.heading, { color: cleared ? t.good : t.ink }]}>
          {formatMoneyMinor(line.balanceMinor, currency)}
        </Text>
      </Row>

      {line.creditLimitMinor !== null && line.creditLimitMinor > 0 && (
        <CreditUtilization usedMinor={line.balanceMinor} limitMinor={line.creditLimitMinor} currency={currency} />
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[type.caption, { color: t.muted }]}>
          {line.aprPct !== null ? `${line.aprPct}% APR` : 'No APR set'}
          {line.minimumPaymentMinor !== null
            ? ` · min ${formatMoneyMinor(line.minimumPaymentMinor, currency)}`
            : ''}
          {` · due ${formatDayLabel(line.cycle.due)}`}
        </Text>
        <Text style={[type.caption, { color: statusColor(t, line.cycleStatus), fontWeight: '700' }]}>
          {STATUS_LABEL[line.cycleStatus]}
        </Text>
      </Row>

      {line.paidThisCycleMinor > 0 && line.cycleStatus !== 'paid' && (
        <Text style={[type.caption, { color: t.muted }]}>
          {formatMoneyMinor(line.paidThisCycleMinor, currency)} paid this cycle
        </Text>
      )}
    </Card>
  );
}

const styles = {
  badge: { borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 },
};
