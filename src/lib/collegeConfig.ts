// Shared college configuration for consistent options across the app
export const collegeConfig = {
  'SVECW': {
    branches: ['CSE', 'AIDS', 'AIML', 'CSE-CS', 'IT', 'ECE', 'EEE', 'CE', 'ME'],
    facultyBranches: ['CSE', 'AIDS', 'AIML', 'CSE-CS', 'IT', 'ECE', 'EEE', 'CE', 'ME', 'Freshman Engineering'],
    years: { default: ['1', '2', '3', '4'] },
    sections: ['A', 'B', 'C']
  },
  'Smt. B seetha Polytechnic': {
    branches: ['Computer Engineering', 'ECE', 'EEE', 'Applied Electronics and Instrumentation Engineering'],
    facultyBranches: ['Computer Engineering', 'ECE', 'EEE', 'Applied Electronics and Instrumentation Engineering'],
    years: { default: ['1', '2', '3'] },
    sections: ['A', 'B']
  },
  'VDC': {
    branches: ['BDS', 'MDS'],
    facultyBranches: ['BDS', 'MDS'],
    years: { 
      'BDS': ['1', '2', '3', '4', '5'],
      'MDS': ['1', '2', '3']
    },
    sections: []
  },
  'Shri vishnu college of pharmacy': {
    branches: ['B.Pharm', 'M.Pharm', 'Pharm.D', 'Pharm.D(PB)'],
    facultyBranches: ['B.Pharm', 'M.Pharm', 'Pharm.D', 'Pharm.D(PB)'],
    years: {
      'B.Pharm': ['1', '2', '3', '4'],
      'Pharm.D': ['1', '2', '3', '4', '5', '6'],
      'Pharm.D(PB)': ['1', '2', '3'],
      'M.Pharm': ['1', '2']
    },
    sections: []
  },
  'B V Raju college': {
    branches: ['B.Sc', 'B.Com', 'BCA', 'M.Sc', 'MCA'],
    facultyBranches: ['B.Sc', 'B.Com', 'BCA', 'M.Sc', 'MCA'],
    years: {
      'B.Sc': ['1', '2', '3'],
      'B.Com': ['1', '2', '3'],
      'BCA': ['1', '2', '3'],
      'M.Sc': ['1', '2'],
      'MCA': ['1', '2']
    },
    sections: []
  }
};

export type CollegeKey = keyof typeof collegeConfig;

export const getColleges = (): string[] => Object.keys(collegeConfig);

export const getBranches = (college: string): string[] => {
  if (!college || !collegeConfig[college as CollegeKey]) return [];
  return collegeConfig[college as CollegeKey].branches;
};

export const getFacultyDepartments = (college: string): string[] => {
  if (!college || !collegeConfig[college as CollegeKey]) return [];
  return collegeConfig[college as CollegeKey].facultyBranches;
};

export const getYears = (college: string, branch?: string): string[] => {
  if (!college || !collegeConfig[college as CollegeKey]) return [];
  const config = collegeConfig[college as CollegeKey];
  const years = config.years as Record<string, string[]>;
  if (years.default) return years.default;
  if (branch && years[branch]) return years[branch];
  return [];
};

export const getSections = (college: string): string[] => {
  if (!college || !collegeConfig[college as CollegeKey]) return [];
  return collegeConfig[college as CollegeKey].sections;
};
