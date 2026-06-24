import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import nonAttendanceDateService, { type NonAttendanceDate } from '../services/nonAttendanceDateService';
import { ListSkeleton } from '../components/LoadingSkeletons';

export default function NonAttendanceDatesPage() {
  const [dates, setDates] = useState<NonAttendanceDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  const [formData, setFormData] = useState({
    date: '',
    reason: '',
    description: '',
  });

  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadDates();
  }, []);

  const loadDates = async () => {
    try {
      setLoading(true);
      const response = await nonAttendanceDateService.getNonAttendanceDates();
      setDates(response.data || []);
    } catch (error) {
      toast.error('Failed to load excluded dates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await nonAttendanceDateService.createNonAttendanceDate(formData);
      toast.success('Date added successfully');
      setShowAddModal(false);
      setFormData({ date: '', reason: '', description: '' });
      loadDates();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add date');
    }
  };

  const handleGenerateWeekends = async () => {
    try {
      const response = await nonAttendanceDateService.generateWeekendsForYear(generateYear);
      toast.success(`Generated ${response.data?.count || 0} weekend dates for ${generateYear}`);
      setShowGenerateModal(false);
      loadDates();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate weekends');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this excluded date?')) return;
    
    try {
      await nonAttendanceDateService.deleteNonAttendanceDate(id);
      toast.success('Date deleted successfully');
      loadDates();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete date');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
  };

  const groupDatesByMonth = () => {
    const grouped: { [key: string]: NonAttendanceDate[] } = {};
    dates.forEach(date => {
      const monthYear = new Date(date.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(date);
    });
    return grouped;
  };

  const groupedDates = groupDatesByMonth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2">
              <Calendar className="size-8" />
              Non-Attendance Dates
            </h1>
            <p className="text-muted-foreground">
              Manage dates excluded from attendance (holidays, weekends, etc.)
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowGenerateModal(true)} variant="outline">
              <Calendar className="mr-2 size-4" />
              Generate Weekends
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 size-4" />
              Add Date
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex gap-3 pt-6">
            <AlertCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Excluded dates won't be counted in attendance calculations</li>
                <li>Weekends can be auto-generated for an entire year</li>
                <li>Add holidays and special dates manually</li>
                <li>These dates apply to all programs unless specified otherwise</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Dates List */}
        {loading ? (
          <ListSkeleton rows={6} />
        ) : dates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No excluded dates configured. Click "Add Date" or "Generate Weekends" to start.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.keys(groupedDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map(monthYear => (
              <Card key={monthYear}>
                <CardHeader>
                  <CardTitle className="text-lg">{monthYear}</CardTitle>
                  <CardDescription>{groupedDates[monthYear].length} excluded dates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {groupedDates[monthYear]
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map(date => (
                        <div 
                          key={date.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{formatDate(date.date)}</div>
                            <div className="text-sm text-muted-foreground">{date.reason}</div>
                            {date.description && (
                              <div className="text-xs text-muted-foreground mt-1">{date.description}</div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(date.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Date Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Excluded Date</DialogTitle>
              <DialogDescription>
                Add a date that should be excluded from attendance calculations
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddDate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., National Holiday, Weekend, Program Break"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Date</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Generate Weekends Modal */}
        <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Weekend Dates</DialogTitle>
              <DialogDescription>
                Automatically create excluded dates for all Saturdays and Sundays in a year
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min={2020}
                  max={2100}
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  This will create approximately 104 excluded dates (52 Saturdays + 52 Sundays)
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateWeekends}>
                  Generate Weekends
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
