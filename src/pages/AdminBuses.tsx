import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatTo12Hour } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface BusDetail {
  id: string;
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
  
  // Add bus dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    bus_number: '',
    route: '',
    departure_time: '',
    arrival_time: '',
    capacity: '',
  });
  const [adding, setAdding] = useState(false);
  
  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [busToDelete, setBusToDelete] = useState<BusDetail | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handleAddBus = async () => {
    if (!addForm.bus_number || !addForm.route) {
      toast({
        title: 'Error',
        description: 'Bus number and route are required',
        variant: 'destructive',
      });
      return;
    }

    setAdding(true);
    const { error } = await supabase
      .from('bus_details')
      .insert({
        bus_number: addForm.bus_number,
        route: addForm.route,
        departure_time: addForm.departure_time || null,
        arrival_time: addForm.arrival_time || null,
        capacity: addForm.capacity ? parseInt(addForm.capacity) : null,
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add bus',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Bus added successfully',
      });
      setShowAddDialog(false);
      setAddForm({ bus_number: '', route: '', departure_time: '', arrival_time: '', capacity: '' });
      fetchBuses();
    }
    setAdding(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, bus: BusDetail) => {
    e.stopPropagation();
    setBusToDelete(bus);
    setDeleteConfirmText('');
    setShowDeleteDialog(true);
  };

  const handleDeleteBus = async () => {
    if (!busToDelete || deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    const { error } = await supabase
      .from('bus_details')
      .delete()
      .eq('ID', busToDelete.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete bus',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `Bus ${busToDelete.bus_number} deleted successfully`,
      });
      setShowDeleteDialog(false);
      setBusToDelete(null);
      fetchBuses();
    }
    setDeleting(false);
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Bus Management</h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => setShowAddDialog(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              Add Bus
            </Button>
            <Button onClick={() => navigate('/admin')} variant="outline" className="flex-1 sm:flex-none">
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buses.map((bus) => (
            <Card
              key={bus.id}
              className="hover:shadow-lg transition-shadow cursor-pointer relative group"
              onClick={() => navigate(`/admin/bus/${bus.bus_number}`)}
            >
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={(e) => handleDeleteClick(e, bus)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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

      {/* Add Bus Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Bus</DialogTitle>
            <DialogDescription>Enter the details for the new bus.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bus_number">Bus Number *</Label>
              <Input
                id="bus_number"
                value={addForm.bus_number}
                onChange={(e) => setAddForm({ ...addForm, bus_number: e.target.value })}
                placeholder="e.g., 1, 2, 3"
              />
            </div>
            <div>
              <Label htmlFor="route">Route *</Label>
              <Input
                id="route"
                value={addForm.route}
                onChange={(e) => setAddForm({ ...addForm, route: e.target.value })}
                placeholder="e.g., Campus - City Center"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="departure_time">Departure Time</Label>
                <Input
                  id="departure_time"
                  type="time"
                  value={addForm.departure_time}
                  onChange={(e) => setAddForm({ ...addForm, departure_time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="arrival_time">Arrival Time</Label>
                <Input
                  id="arrival_time"
                  type="time"
                  value={addForm.arrival_time}
                  onChange={(e) => setAddForm({ ...addForm, arrival_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={addForm.capacity}
                onChange={(e) => setAddForm({ ...addForm, capacity: e.target.value })}
                placeholder="e.g., 50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddBus} disabled={adding}>
              {adding ? 'Adding...' : 'Add Bus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Bus {busToDelete?.bus_number}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>This action cannot be undone. This will permanently delete the bus and all associated data.</p>
              <p className="font-medium">Type <span className="font-bold text-destructive">DELETE</span> to confirm:</p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBusToDelete(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteBus}
              disabled={deleteConfirmText !== 'DELETE' || deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Bus'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBuses;
