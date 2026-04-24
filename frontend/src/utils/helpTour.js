import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/helpTour.css';

const baseSteps = [
  {
    element: '.help-btn',
    popover: {
      title: 'Help Button',
      description: 'Click this button anytime to open a guided product tour for the current screen. The tour explains what each major section, button, chart, and data block is used for.'
    }
  },
  {
    element: '.user-role-badge',
    popover: {
      title: 'Your Role',
      description: 'This badge shows your account role (for example Admin/Teacher). Your role controls what actions you are allowed to perform in this system.'
    }
  },
  {
    element: '.logout-btn',
    popover: {
      title: 'Logout',
      description: 'Use Logout to securely end your session when you finish work, especially on shared systems.'
    }
  }
];

const tours = {
  dashboard: [
    {
      element: '.breadcrumb',
      popover: {
        title: 'Home Screen',
        description: 'This is your main starting point. From here, you can open existing batches, create new batches, and move to achievers.'
      }
    },
    {
      element: '.filter-button',
      popover: {
        title: 'Filters Panel',
        description: 'Use this to show/hide filtering options. Filters help you quickly narrow down which batches are shown.'
      }
    },
    {
      element: '.filter-options',
      popover: {
        title: 'Academic Year Filter',
        description: 'Choose an academic year to view only batches for that year. This keeps the dashboard clean when many batches exist.'
      }
    },
    {
      element: '.btn-achievers',
      popover: {
        title: 'Achievers',
        description: 'Open the achievers area to highlight top-performing students and view their profiles.'
      }
    },
    {
      element: '.btn-add-batch',
      popover: {
        title: 'Add Batch',
        description: 'Create a new batch before adding students or marks. Batch configuration also controls allowed subjects.'
      }
    },
    {
      element: '.courses-grid',
      popover: {
        title: 'Batch Cards Grid',
        description: 'Each card is one batch. Click a card to enter batch details. Rename/delete controls on each card help with maintenance.'
      }
    },
    {
      element: '.course-card',
      popover: {
        title: 'Batch Card',
        description: 'Shows batch name, type, academic year, and subjects. This is the quick summary block before opening full batch details.'
      }
    }
  ],
  'add-batch': [
    {
      element: '.add-batch-header',
      popover: {
        title: 'Create Batch Screen',
        description: 'Use this form to configure a new batch. This is the foundation for student admission, exam entry, and analytics.'
      }
    },
    {
      element: '.add-batch-form',
      popover: {
        title: 'Batch Form',
        description: 'Enter batch name, years, type, and subjects. Subject setup here is important because exam entry and analytics use it later.'
      }
    },
    {
      element: '.subjects-list',
      popover: {
        title: 'Selected Subjects',
        description: 'These chips show which subjects are active for this batch. You can remove any subject before final submission.'
      }
    },
    {
      element: '.form-actions',
      popover: {
        title: 'Save Actions',
        description: 'Use Create Batch to save. Use Cancel to return without changes.'
      }
    }
  ],
  'batch-detail': [
    {
      element: '.batch-header',
      popover: {
        title: 'Batch Header',
        description: 'Shows the selected batch and a back button. Use this page to manage students, exams, and performance in one place.'
      }
    },
    {
      element: '.batch-topics',
      popover: {
        title: 'Batch Subjects',
        description: 'These are the official subjects configured for this batch. Exam entry and analytics use this to keep data consistent.'
      }
    },
    {
      element: '.batch-tabs',
      popover: {
        title: 'Main Tabs',
        description: 'Switch between Students management and Performance analytics for the selected batch.'
      }
    },
    {
      element: '.management-buttons',
      popover: {
        title: 'Student & Exam Actions',
        description: 'Add student, bulk edit via Excel, add new exam marks, and generate complete batch report from this action area.'
      }
    },
    {
      element: '.list-controls',
      popover: {
        title: 'Search and Filters',
        description: 'Use search and dropdown filters to find students faster by name, admission number, gender, and community.'
      }
    },
    {
      element: '.student-table',
      popover: {
        title: 'Students Table',
        description: 'This table is your operational grid. View opens full student profile; Edit opens student form for corrections.'
      }
    }
  ],
  'batch-performance': [
    {
      element: '.perf-filters',
      popover: {
        title: 'Analytics Filters',
        description: 'Control test type, date range, subject, and chart sections. Use filters to answer specific academic questions.'
      }
    },
    {
      element: '.perf-stat-cards',
      popover: {
        title: 'Quick Stats Cards',
        description: 'These cards summarize batch performance, participation, and advanced distribution stats for quick monitoring.'
      }
    },
    {
      element: '.perf-charts-grid',
      popover: {
        title: 'Charts Area',
        description: 'Visual insights: trends over time, subject performance, and score distributions. Useful for identifying patterns quickly.'
      }
    },
    {
      element: '.perf-rankings',
      popover: {
        title: 'Ranking & Risk Blocks',
        description: 'Shows top/bottom performers, risk dashboard, and diagnostic summaries for focused teacher interventions.'
      }
    }
  ],
  'add-student': [
    {
      element: '.add-student-header',
      popover: {
        title: 'Add / Edit Student',
        description: 'This screen captures complete student profile data used throughout the system: academics, contacts, and counselling.'
      }
    },
    {
      element: '.mode-toggle',
      popover: {
        title: 'Entry Mode',
        description: 'Switch between manual entry and Excel upload mode depending on whether you are adding one student or many.'
      }
    },
    {
      element: '.form-section',
      popover: {
        title: 'Form Sections',
        description: 'Each section groups related information (personal, parent, 10th/12th marks, entrance exams, counselling). Fill carefully for accurate reports.'
      }
    },
    {
      element: '.form-actions',
      popover: {
        title: 'Save Student Data',
        description: 'Submit saves the student record. Cancel returns without saving changes made in this form session.'
      }
    }
  ],
  'add-exam': [
    {
      element: '.add-exam-header',
      popover: {
        title: 'Add Exam Marks',
        description: 'Use this page to enter unit-test or monthly-test marks for the current batch.'
      }
    },
    {
      element: '.mode-selector',
      popover: {
        title: 'Marks Entry Mode',
        description: 'Manual Entry is good for quick updates. Excel Upload is better for large classes.'
      }
    },
    {
      element: '.marks-entry-table',
      popover: {
        title: 'Marks Grid',
        description: 'Enter each student’s marks here. For unit tests, one subject column is used. For monthly tests, subject-wise columns are shown.'
      }
    },
    {
      element: '.upload-steps',
      popover: {
        title: 'Excel Upload Workflow',
        description: 'Step 1: download template. Step 2: fill marks. Step 3: upload. This ensures format consistency and fewer upload errors.'
      }
    },
    {
      element: '.form-actions',
      popover: {
        title: 'Save Exam Marks',
        description: 'Save Exam Marks sends all current entries to the database. Progress overlays are shown while saving.'
      }
    }
  ],
  'student-profile': [
    {
      element: '.profile-header',
      popover: {
        title: 'Student Profile Header',
        description: 'Shows student identity and quick actions like going back and downloading full report.'
      }
    },
    {
      element: '.tab-navigation',
      popover: {
        title: 'Profile Tabs',
        description: 'Use tabs to switch among personal details, marks/analysis, and feedback history.'
      }
    },
    {
      element: '.student-metrics-grid',
      popover: {
        title: 'Advanced Metrics Cards',
        description: 'This block summarizes average, percentile, participation, consistency, trend, and risk. Hover info icons for plain-language explanations.'
      }
    },
    {
      element: '.student-risk-reasons',
      popover: {
        title: 'Risk Explanation',
        description: 'Lists why current risk level is assigned and gives recommended teacher action for follow-up.'
      }
    },
    {
      element: '.marks-table',
      popover: {
        title: 'Marks Tables',
        description: 'Tabular view of daily and mock marks, along with class averages and top scores for comparison.'
      }
    },
    {
      element: '.feedback-section',
      popover: {
        title: 'Teacher Feedback Area',
        description: 'Record qualitative feedback and signatures. This creates a longitudinal support history for the student.'
      }
    }
  ],
  achievers: [
    {
      element: '.achievers-header',
      popover: {
        title: 'Achievers Section',
        description: 'Showcases high performers. You can add achievers and open their full profile for deeper review.'
      }
    },
    {
      element: '.add-achiever-btn',
      popover: {
        title: 'Add Achiever',
        description: 'Use this to add a student to achievers with supporting details and achievements.'
      }
    },
    {
      element: '.achievers-grid',
      popover: {
        title: 'Achievers Grid',
        description: 'Each card represents one achiever profile. Click a card to open student details and analysis.'
      }
    }
  ]
};

function detectContext() {
  if (document.querySelector('.add-exam')) return 'add-exam';
  if (document.querySelector('.add-student')) return 'add-student';
  if (document.querySelector('.student-profile')) return 'student-profile';
  if (document.querySelector('.achievers-section')) return 'achievers';
  if (document.querySelector('.add-batch')) return 'add-batch';
  if (document.querySelector('.batch-performance')) return 'batch-performance';
  if (document.querySelector('.batch-detail')) return 'batch-detail';
  if (document.querySelector('.dashboard')) return 'dashboard';
  return 'dashboard';
}

function existingSteps(steps) {
  return steps.filter((step) => !step.element || document.querySelector(step.element));
}

export function startHelpTour() {
  const context = detectContext();
  const contextSteps = tours[context] || tours.dashboard;
  const steps = existingSteps([...baseSteps, ...contextSteps]);

  if (steps.length === 0) return;

  const tour = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    stagePadding: 8,
    overlayColor: 'rgba(15, 23, 42, 0.70)',
    popoverClass: 'graavitons-tour-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Finish',
    steps
  });

  tour.drive();
}
