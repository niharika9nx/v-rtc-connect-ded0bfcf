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
import * as XLSX from 'xlsx';
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

    const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Handle Excel files
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const validated = jsonData.map((row: any) => {
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
        } catch (error) {
          toast({
            title: 'Error parsing Excel file',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive'
          });
        }
      };
      reader.readAsArrayBuffer(uploadedFile);
    } else {
      // Handle CSV files
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
    }
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
                <Label htmlFor="csv-file">CSV or Excel File</Label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
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
                Download Template (CSV)
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
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-2">
                      <p className="text-amber-600 text-xs font-medium">
                        ⚠️ Important: This only UPDATES existing profiles. Users must sign up first before their profiles can be updated via import.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Required columns:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                      <li><strong>name</strong> - Full name</li>
                      <li><strong>email</strong> - Must match existing user's email</li>
                      <li><strong>phone</strong> - 10-digit phone number</li>
                      <li><strong>gender</strong> - male, female, or other</li>
                      <li><strong>role</strong> - student, faculty, or admin</li>
                      <li><strong>college</strong> - College name</li>
                      <li><strong>registration_id</strong> - Student registration ID</li>
                      <li><strong>branch</strong> - Branch/Department</li>
                      <li><strong>year</strong> - Year of study</li>
                      <li><strong>section</strong> - Section (A, B, C, etc.)</li>
                      <li><strong>department</strong> - Department name</li>
                      <li><strong>bus_number</strong> - Assigned bus number</li>
                    </ul>
                    <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
                      <p className="font-semibold mb-1">Example row:</p>
                      <code className="text-primary break-all">John Doe,john@example.com,9876543210,male,student,SVECW,20B01A0501,CSE,2,A,CSE,1</code>
                    </div>
                  </div>
                )}
                {importType === 'bus_details' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Bus Details:</h4>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 mb-2">
                      <p className="text-green-600 text-xs font-medium">
                        ✅ This creates NEW bus records. No pre-existing data required.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Required columns:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                      <li><strong>bus_number</strong> - Unique identifier (e.g., "1", "2", "3")</li>
                      <li><strong>route</strong> - Route description text</li>
                      <li><strong>capacity</strong> - Number of seats (must be a number)</li>
                      <li><strong>departure_time</strong> - Format: HH:MM:SS (e.g., "08:00:00")</li>
                      <li><strong>arrival_time</strong> - Format: HH:MM:SS (e.g., "18:00:00")</li>
                    </ul>
                    <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
                      <p className="font-semibold mb-1">Example row:</p>
                      <code className="text-primary">1,Route A - College to City,50,08:00:00,18:00:00</code>
                    </div>
                  </div>
                )}
                {importType === 'fee_history' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Fee History:</h4>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-2">
                      <p className="text-amber-600 text-xs font-medium">
                        ⚠️ Important: Users must exist in the system. The user_email must match an existing profile's email.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Required columns:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                      <li><strong>user_email</strong> - Must match an existing user's email</li>
                      <li><strong>bus_number</strong> - Must match an existing bus number</li>
                      <li><strong>month</strong> - Full month name (January, February, March, April, May, June, July, August, September, October, November, December)</li>
                      <li><strong>year</strong> - 4-digit year (e.g., 2025)</li>
                      <li><strong>amount</strong> - Fee amount (number, e.g., 1000)</li>
                      <li><strong>status</strong> - Must be exactly "paid" or "due"</li>
                    </ul>
                    <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
                      <p className="font-semibold mb-1">Example row:</p>
                      <code className="text-primary">john@example.com,1,January,2025,1000,paid</code>
                    </div>
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