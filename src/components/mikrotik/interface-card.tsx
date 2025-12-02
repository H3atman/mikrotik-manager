'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MikrotikInterface } from '@/lib/mikrotik';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface InterfaceCardProps {
  interface: MikrotikInterface;
  onToggle: (id: string, disabled: boolean) => void;
  loading?: boolean;
}

export function InterfaceCard({ 
  interface: iface, 
  onToggle,
  loading = false
}: InterfaceCardProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleToggle = () => {
    onToggle(iface.id, iface.disabled);
    setShowConfirmDialog(false);
  };

  return (
    <>
      <Card className={iface.disabled ? 'border-muted' : 'border-primary/20'}>
        <CardContent className="pt-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-medium">{iface.name}</h3>
            <Badge variant={iface.disabled ? 'outline' : 'default'}>
              {iface.disabled ? 'Disabled' : 'Enabled'}
            </Badge>
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{iface.type}</span>
            </div>
            
            {iface['mac-address'] && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">MAC:</span>
                <code className="text-xs">{iface['mac-address']}</code>
              </div>
            )}
            
            {iface.running !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Running:</span>
                <span>{iface.running ? 'Yes' : 'No'}</span>
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter>
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={loading}
            variant={iface.disabled ? 'default' : 'destructive'}
            className="w-full"
          >
            {iface.disabled ? 'Enable Interface' : 'Disable Interface'}
          </Button>
        </CardFooter>
      </Card>

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={iface.disabled ? 'Enable Interface' : 'Disable Interface'}
        description={`Are you sure you want to ${iface.disabled ? 'enable' : 'disable'} the interface "${iface.name}"?`}
        actionLabel={iface.disabled ? 'Enable' : 'Disable'}
        onAction={handleToggle}
        variant={iface.disabled ? 'default' : 'destructive'}
        loading={loading}
      />
    </>
  );
} 