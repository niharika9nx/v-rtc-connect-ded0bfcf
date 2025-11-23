import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatTo12Hour } from '@/lib/utils';

interface BusDetail {
  id: number;
  bus_number: string;
  route: string;
  departure_time: string;
  arrival_time: string;
  capacity: number;
}

const AdminBuses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [buses, setBuses] = useState<BusDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBuses();
  }, []);

  const fetchBuses = async () => {
    const { data, error } = await supabase
      .from('bus_details')
      .select('*')
      .order('bus_number');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load buses',
        variant: 'destructive',
      });
    } else {
      const mappedData = (data || []).map((bus: any) => ({
        id: bus.ID,
        bus_number: bus.bus_number,
        route: bus.route,
        departure_time: bus.departure_time,
        arrival_time: bus.arrival_time,
        capacity: bus.capacity,
      }));
      setBuses(mappedData);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Bus Management</h1>
          <Button onClick={() => navigate('/admin')} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buses.map((bus) => (
            <Card
              key={bus.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/bus/${bus.bus_number}`)}
            >
              <CardHeader>
                <CardTitle>Bus {bus.bus_number}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">Route:</span> {bus.route}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Departure:</span>{' '}
                  {formatTo12Hour(bus.departure_time)}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Arrival:</span> {formatTo12Hour(bus.arrival_time)}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Capacity:</span> {bus.capacity}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminBuses;
