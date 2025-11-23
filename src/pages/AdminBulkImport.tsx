import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Download, CheckCircle, XCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

type ImportType = 'profiles' | 'bus_details' | 'fee_history';

interface ParsedRow {
  data: any;
  isValid: boolean;
  errors: string[];
}

const AdminBulkImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [importType, setImportType] = useState<ImportType>('profiles');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  const templateData = {
    profiles: {
      headers: ['name', 'email', 'phone', 'gender', 'role', 'college', 'registration_id', 'branch', 'year', 'section', 'department', 'bus_number'],
      sample: 'John Doe,john@example.com,9876543210,male,student,SVECW,20B01A0501,CSE,2,A,CSE,1'
    },
    bus_details: {
      headers: ['bus_number', 'route', 'capacity', 'departure_time', 'arrival_time'],
      sample: '1,Route A - College to City,50,08:00:00,18:00:00'
    },
    fee_history: {
      headers: ['user_email', 'bus_number', 'month', 'year', 'amount', 'status'],
      sample: 'john@example.com,1,January,2025,1000,paid'
    }
  };

  const downloadTemplate = () => {
    const template = templateData[importType];
    const csv = template.headers.join(',') + '\n' + template.sample;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const validateProfileRow = (row: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!row.name || row.name.trim() === '') errors.push('Name is required');
    if (!row.email || !row.email.includes('@')) errors.push('Valid email is required');
    if (!row.phone || row.phone.length < 10) errors.push('Valid phone number is required');
    if (!['male', 'female', 'other'].includes(row.gender?.toLowerCase())) errors.push('Gender must be male, female, or other');
    if (!['student', 'faculty', 'admin'].includes(row.role?.toLowerCase())) errors.push('Role must be student, faculty, or admin');
    
    return { isValid: errors.length === 0, errors };
  };

  const validateBusDetailsRow = (row: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!row.bus_number) errors.push('Bus number is required');
    if (!row.route) errors.push('Route is required');
    if (!row.capacity || isNaN(parseInt(row.capacity))) errors.push('Valid capacity is required');
    
    return { isValid: errors.length === 0, errors };
  };

  const validateFeeHistoryRow = (row: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!row.user_email || !row.user_email.includes('@')) errors.push('Valid user email is required');
    if (!row.bus_number) errors.push('Bus number is required');
    if (!row.month) errors.push('Month is required');
    if (!row.year || isNaN(parseInt(row.year))) errors.push('Valid year is required');
    if (!row.amount || isNaN(parseFloat(row.amount))) errors.push('Valid amount is required');
    if (!['paid', 'due'].includes(row.status?.toLowerCase())) errors.push('Status must be paid or due');
    
    return { isValid: errors.length === 0, errors };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setImportResults(null);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validated = results.data.map((row: any) => {
          let validation;
          switch (importType) {
            case 'profiles':
              validation = validateProfileRow(row);
              break;
            case 'bus_details':
              validation = validateBusDetailsRow(row);
              break;
            case 'fee_history':
              validation = validateFeeHistoryRow(row);
              break;
            default:
              validation = { isValid: false, errors: ['Unknown import type'] };
          }
          return {
            data: row,
            isValid: validation.isValid,
            errors: validation.errors
          };
        });
        setParsedData(validated);
      },
      error: (error) => {
        toast({
          title: 'Error parsing CSV',
          description: error.message,
          variant: 'destructive'
        });
      }
    });
  };

  const handleImport = async () => {
    if (!parsedData.length) {
      toast({
        title: 'No data to import',
        description: 'Please upload a CSV file first',
        variant: 'destructive'
      });
      return;
    }

    const validRows = parsedData.filter(row => row.isValid);
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'All rows have validation errors',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const row of validRows) {
        try {
          if (importType === 'profiles') {
            // Note: Profile import requires pre-existing auth users
            // This updates existing profiles based on email
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', row.data.email)
              .single();
            
            if (!existingProfile) {
              throw new Error('User not found - profiles must be created through signup first');
            }
            
            const { error } = await supabase
              .from('profiles')
              .update({
                name: row.data.name,
                phone: row.data.phone,
                gender: row.data.gender?.toLowerCase(),
                college: row.data.college,
                registration_id: row.data.registration_id,
                branch: row.data.branch,
                year: row.data.year,
                section: row.data.section,
                department: row.data.department,
                bus_number: row.data.bus_number
              })
              .eq('id', existingProfile.id);
            
            if (error) throw error;
          } else if (importType === 'bus_details') {
            const { error } = await supabase.from('bus_details').insert({
              bus_number: row.data.bus_number,
              route: row.data.route,
              capacity: parseInt(row.data.capacity),
              departure_time: row.data.departure_time,
              arrival_time: row.data.arrival_time
            });
            
            if (error) throw error;
          } else if (importType === 'fee_history') {
            // First, get user_id from email
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', row.data.user_email)
              .single();
            
            if (!profile) throw new Error('User not found');
            
            const { error } = await supabase.from('fee_history').insert({
              user_id: profile.id,
              bus_number: row.data.bus_number,
              month: row.data.month,
              year: parseInt(row.data.year),
              amount: parseFloat(row.data.amount),
              status: row.data.status?.toLowerCase()
            });
            
            if (error) throw error;
          }
          
          successCount++;
        } catch (error) {
          console.error('Error importing row:', error);
          failedCount++;
        }
      }

      setImportResults({ success: successCount, failed: failedCount });
      
      toast({
        title: 'Import completed',
        description: `Successfully imported ${successCount} records. ${failedCount} failed.`,
        variant: successCount > 0 ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({
        title: 'Import failed',
        description: 'An error occurred during import',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">Bulk Data Import</h1>
            <p className="text-muted-foreground">Import multiple records using CSV files</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Import Configuration</CardTitle>
              <CardDescription>Select data type and upload CSV file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-type">Data Type</Label>
                <Select value={importType} onValueChange={(value) => setImportType(value as ImportType)}>
                  <SelectTrigger id="import-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profiles">Student/Faculty Profiles</SelectItem>
                    <SelectItem value="bus_details">Bus Details</SelectItem>
                    <SelectItem value="fee_history">Fee History</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              <Button
                onClick={downloadTemplate}
                variant="outline"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>

              {parsedData.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Rows:</span>
                    <span className="font-semibold">{parsedData.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valid Rows:</span>
                    <span className="font-semibold text-green-600">
                      {parsedData.filter(r => r.isValid).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Invalid Rows:</span>
                    <span className="font-semibold text-destructive">
                      {parsedData.filter(r => !r.isValid).length}
                    </span>
                  </div>
                </div>
              )}

              {importResults && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{importResults.success} records imported successfully</span>
                  </div>
                  {importResults.failed > 0 && (
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span>{importResults.failed} records failed</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!parsedData.length || isProcessing || parsedData.filter(r => r.isValid).length === 0}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isProcessing ? 'Importing...' : 'Import Data'}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>CSV Format Guide</CardTitle>
              <CardDescription>Required columns and data format</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                {importType === 'profiles' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Student/Faculty Profiles:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>name, email, phone, gender (male/female/other)</li>
                      <li>role (student/faculty/admin)</li>
                      <li>college, registration_id</li>
                      <li>branch, year, section, department</li>
                      <li>bus_number</li>
                    </ul>
                  </div>
                )}
                {importType === 'bus_details' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Bus Details:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>bus_number (unique identifier)</li>
                      <li>route (description)</li>
                      <li>capacity (number)</li>
                      <li>departure_time (HH:MM:SS)</li>
                      <li>arrival_time (HH:MM:SS)</li>
                    </ul>
                  </div>
                )}
                {importType === 'fee_history' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Fee History:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>user_email (must exist in profiles)</li>
                      <li>bus_number</li>
                      <li>month (January, February, etc.)</li>
                      <li>year (number)</li>
                      <li>amount (number)</li>
                      <li>status (paid/due)</li>
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {parsedData.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>Review data before importing</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Status</TableHead>
                      {Object.keys(parsedData[0].data).map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index} className={!row.isValid ? 'bg-destructive/10' : ''}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-destructive" />
                              <span className="text-xs text-destructive">{row.errors[0]}</span>
                            </div>
                          )}
                        </TableCell>
                        {Object.values(row.data).map((value: any, i) => (
                          <TableCell key={i}>{value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminBulkImport;