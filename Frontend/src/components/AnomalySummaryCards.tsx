import { Card, CardContent, CardDescription, CardHeader } from './ui/card';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { AnomalySummary } from '../types/anomaly';

interface AnomalySummaryCardsProps {
  summary: AnomalySummary;
  isLoading?: boolean;
  error?: string | null;
}

export default function AnomalySummaryCards({ summary, isLoading, error }: AnomalySummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24 mb-2"></div>
              </div>
              <div className="animate-pulse size-10 bg-muted rounded-lg"></div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse">
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-32"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium">Stats unavailable</p>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    {
      title: 'Critical Issues',
      description: 'Require immediate action',
      value: summary.critical,
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      iconBg: 'bg-destructive/10',
      trend: summary.critical > 0 ? 'Needs attention' : 'All clear',
      trendColor: summary.critical > 0 ? 'text-destructive' : 'text-muted-foreground'
    },
    {
      title: 'Warnings',
      description: 'Review recommended',
      value: summary.warning,
      icon: AlertCircle,
      iconColor: 'text-accent',
      iconBg: 'bg-accent/10',
      trend: summary.warning > 0 ? 'Action suggested' : 'Looking good',
      trendColor: summary.warning > 0 ? 'text-accent' : 'text-muted-foreground'
    },
    {
      title: 'Info',
      description: 'Informational only',
      value: summary.info,
      icon: Info,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      trend: 'No action required',
      trendColor: 'text-muted-foreground'
    },
    {
      title: 'Resolved',
      description: 'Previously fixed',
      value: summary.resolved,
      icon: CheckCircle,
      iconColor: 'text-secondary',
      iconBg: 'bg-secondary/10',
      trend: `${summary.dismissed} dismissed`,
      trendColor: 'text-muted-foreground'
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{card.title}</CardDescription>
              <div className={`flex size-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                <Icon className={`size-5 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold" style={{ fontSize: '2rem', lineHeight: '1' }}>
                    {card.value}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${card.trendColor}`}>
                  {card.trend}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
