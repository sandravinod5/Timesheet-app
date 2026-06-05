export type ApiEnvelope<T> = {
  success: boolean;
  action: string | null;
  data: T;
  error: string | null;
};

export type UserSummary = {
  employee: string;
  employeeName: string;
  userId: string;
};

export type RunningTimer = {
  timesheetDetailId: string;
  timesheetId: string;
  task: string;
  taskSubject: string;
  owner?: string | null;
  userId?: string | null;
  employee?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  createdBy?: string | null;
  createdByEmail?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  project?: string | null;
  projectName?: string | null;
  activityType?: string | null;
  notes?: string | null;
  fromTime: string;
  fromTimeUtc?: string | null;
  toTime?: string | null;
  toTimeUtc?: string | null;
  hours: number;
  liveHours?: number;
  isRunning: boolean;
};

export type Task = {
  taskId: string;
  subject: string;
  status: string;
  customCustomStatus?: string | null;
  rawStatus?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerGroup?: string | null;
  project?: string | null;
  projectName?: string | null;
  owner?: string | null;
  ownerName?: string | null;
  customProjectType?: string;
  expEndDate?: string | null;
  createdOn?: string | null;
  isOverdue: number;
};

export type TaskSummary = {
  total: number;
  assigned: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
};

export type OverviewData = {
  employee: UserSummary;
  period: { fromDate: string; toDate: string };
  serverNowUtc?: string;
  runningTimer: RunningTimer | null;
  monthSummary: { trackedHours: number; expectedHours: number };
  kpis: TaskSummary;
  recentTasks: Task[];
  recentClientVisits: TimesheetEntry[];
};

export type TasksData = {
  summary: TaskSummary;
  tasks: Task[];
};

export type TimesheetEntry = RunningTimer;

export type TimesheetsData = {
  period: { fromDate: string; toDate: string };
  serverNowUtc?: string;
  runningTimer: RunningTimer | null;
  summary: { entries: number; completedEntries: number; totalHours: number };
  timesheets: TimesheetEntry[];
};

export type CustomerSummary = {
  customerId: string;
  customerName: string;
  customerGroup: string;
  taskCount: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  totalHours: number;
};

export type CustomersData = {
  period: { fromDate: string; toDate: string };
  customers: CustomerSummary[];
};

export type ReportDefinition = {
  key: string;
  label: string;
};

export type ReportsData = {
  period: { fromDate: string; toDate: string };
  serverNowUtc?: string;
  availableReports: ReportDefinition[];
  summary?: {
    kpiCards?: KpiCardsData["kpis"];
    hoursByDay?: HoursByDay[];
  };
  reportKey?: string;
  kpiCards?: KpiCardsData["kpis"];
  hoursByDay?: HoursByDay[];
  rows?: Array<Record<string, string | number | boolean | null>>;
};

export type ActivityTypesData = {
  activityTypes: ActivityTypeOption[];
};

export type ActivityTypeOption = {
  name: string;
  customParentGroup?: string | null;
};

export type SelectOption = {
  value: string;
  label: string;
  shortName?: string | null;
};

export type TaskFormOptionsData = {
  projectTypes: SelectOption[];
  statuses: SelectOption[];
  statusesByProjectType: Record<string, SelectOption[]>;
  customers: SelectOption[];
  projects: SelectOption[];
  months: SelectOption[];
  reports: SelectOption[];
};

export type LeaveBreakdown = {
  leaveType: string;
  days: number;
  applications: number;
};

export type HoursByDay = {
  date: string;
  hours: number;
};

export type VisitByCustomer = {
  customerId: string;
  customerName: string;
  visitCount: number;
  visitDates: string[];
};

export type KpiCard = {
  value: number;
  label: string;
  color: string;
  subLabel?: string;
  delta?: number;
  deltaLabel?: string;
  alert?: boolean;
  breakdown?: LeaveBreakdown[];
  visitBreakdown?: VisitByCustomer[];
};

export type ActiveTimerKpi = {
  isRunning: boolean;
  liveHours: number;
  taskSubject?: string | null;
  customerName?: string | null;
  fromTime?: string | null;
  fromTimeUtc?: string | null;
};

export type DraftEntry = {
  timesheetDetailId: string;
  timesheetId: string;
  task: string | null;
  taskSubject: string | null;
  customerId: string | null;
  customerName: string | null;
  project: string | null;
  projectName: string | null;
  activityType: string | null;
  notes: string | null;
  fromTime: string;
  fromTimeUtc?: string | null;
  toTime: string;
  toTimeUtc?: string | null;
  hours: number;
  canSubmit: boolean;
};

export type DraftsData = {
  drafts: DraftEntry[];
};

export type KpiCardsData = {
  period: { fromDate: string; toDate: string };
  serverNowUtc?: string;
  kpis: {
    tasksCompleted: KpiCard;
    tasksInProgress: KpiCard;
    tasksPending: KpiCard;
    tasksOverdue: KpiCard;
    hoursLogged: KpiCard;
    visitCount: KpiCard;
    leavesTaken: KpiCard;
    activeTimer: ActiveTimerKpi;
  };
  hoursByDay: HoursByDay[];
};
