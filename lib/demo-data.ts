import type {
  CustomerSummary,
  KpiCardsData,
  OverviewData,
  ReportDefinition,
  RunningTimer,
  Task,
  TaskSummary,
  TimesheetEntry
} from "@/lib/types";
import { emptyTaskSummary } from "@/lib/utils";

const reportDefinitions: ReportDefinition[] = [
  { key: "kpi_cards", label: "My KPI Cards" },
  { key: "hours_by_day", label: "Hours by Day" },
  { key: "leave_breakdown", label: "Leave Breakdown" },
  { key: "active_timer", label: "Active Timer" }
];

const tasksSeed: Task[] = [
  {
    taskId: "TASK-0001",
    subject: "Prepare monthly compliance dossier",
    status: "In Progress",
    customerId: "CUST-0001",
    customerName: "Al Noor Ventures",
    customerGroup: "Corporate",
    project: "PROJ-OPS",
    projectName: "Operations Retainer",
    owner: "employee@erpnext.local",
    ownerName: "Task Owner",
    customProjectType: "Compliance",
    expEndDate: "2026-05-08",
    createdOn: "2026-05-01",
    isOverdue: 0
  },
  {
    taskId: "TASK-0002",
    subject: "Site visit follow-up and summary",
    status: "Assigned",
    customerId: "CUST-0002",
    customerName: "Desert Grid LLC",
    customerGroup: "Field",
    project: "PROJ-FIELD",
    projectName: "Field Operations",
    owner: "employee@erpnext.local",
    ownerName: "Task Owner",
    customProjectType: "Visit",
    expEndDate: "2026-05-10",
    createdOn: "2026-05-02",
    isOverdue: 0
  },
  {
    taskId: "TASK-0003",
    subject: "Draft customer utilization report",
    status: "Pending",
    customerId: "CUST-0003",
    customerName: "Mirage Holdings",
    customerGroup: "Reporting",
    project: "PROJ-RPT",
    projectName: "Reporting Pack",
    owner: "employee@erpnext.local",
    ownerName: "Task Owner",
    customProjectType: "Reports",
    expEndDate: "2026-05-04",
    createdOn: "2026-05-01",
    isOverdue: 1
  },
  {
    taskId: "TASK-0004",
    subject: "Complete timesheet reconciliation",
    status: "Completed",
    customerId: "CUST-0001",
    customerName: "Al Noor Ventures",
    customerGroup: "Corporate",
    project: "PROJ-OPS",
    projectName: "Operations Retainer",
    owner: "employee@erpnext.local",
    ownerName: "Task Owner",
    customProjectType: "Internal",
    expEndDate: "2026-05-03",
    createdOn: "2026-04-28",
    isOverdue: 0
  }
];

let demoTimesheets: TimesheetEntry[] = [
  {
    timesheetDetailId: "TSD-001",
    timesheetId: "TS-001",
    task: "TASK-0004",
    taskSubject: "Complete timesheet reconciliation",
    owner: "employee@erpnext.local",
    userId: "employee@erpnext.local",
    employee: "EMP-0001",
    employeeName: "Demo Employee",
    customerId: "CUST-0001",
    customerName: "Al Noor Ventures",
    project: "PROJ-OPS",
    projectName: "Operations Retainer",
    activityType: "Review",
    notes: "Closed remaining April entries.",
    fromTime: "2026-05-02 09:00:00",
    toTime: "2026-05-02 11:30:00",
    hours: 2.5,
    isRunning: false
  },
  {
    timesheetDetailId: "TSD-002",
    timesheetId: "TS-002",
    task: "TASK-0002",
    taskSubject: "Site visit follow-up and summary",
    owner: "employee@erpnext.local",
    userId: "employee@erpnext.local",
    employee: "EMP-0001",
    employeeName: "Demo Employee",
    customerId: "CUST-0002",
    customerName: "Desert Grid LLC",
    project: "PROJ-FIELD",
    projectName: "Field Operations",
    activityType: "Visit",
    notes: "Prepared follow-up checklist.",
    fromTime: "2026-05-03 13:15:00",
    toTime: "2026-05-03 15:00:00",
    hours: 1.75,
    isRunning: false
  }
];

let runningTimer: RunningTimer | null = {
  timesheetDetailId: "TSD-RUN",
  timesheetId: "TS-RUN",
  task: "TASK-0001",
  taskSubject: "Prepare monthly compliance dossier",
  owner: "employee@erpnext.local",
  userId: "employee@erpnext.local",
  employee: "EMP-0001",
  employeeName: "Demo Employee",
  customerId: "CUST-0001",
  customerName: "Al Noor Ventures",
  project: "PROJ-OPS",
  projectName: "Operations Retainer",
  activityType: "Working",
  notes: "Drafting the monthly file set.",
  fromTime: new Date(Date.now() - 1000 * 60 * 83).toISOString().slice(0, 19).replace("T", " "),
  toTime: null,
  hours: 0,
  liveHours: 1.38,
  isRunning: true
};

const STANDARD_HOURS_PER_DAY = 7;

function isoNowText() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function getWorkingDays(fromDate: string, toDate: string) {
  const current = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  let workingDays = 0;

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      workingDays += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

function getExpectedHours(fromDate: string, toDate: string) {
  return getWorkingDays(fromDate, toDate) * STANDARD_HOURS_PER_DAY;
}

function getFilteredTasks(params: Record<string, string>) {
  return tasksSeed.filter((task) => {
    if (params.status && params.status !== "all" && task.status !== params.status) {
      return false;
    }

    if (params.customer && task.customerId !== params.customer) {
      return false;
    }

    if (params.project && task.project !== params.project) {
      return false;
    }

    if (params.search) {
      const haystack = [task.subject, task.customerName, task.projectName, task.taskId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(params.search.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

function buildTaskSummary(tasks: Task[]): TaskSummary {
  return tasks.reduce<TaskSummary>((summary, task) => {
    summary.total += 1;
    summary.assigned += 1;

    if (["Completed", "Closed"].includes(task.status)) {
      summary.completed += 1;
    } else if (
      [
        "Working",
        "In Progress",
        "Under Execution",
        "Under Review",
        "In Progress With BO",
        "Revising Report BO"
      ].includes(task.status)
    ) {
      summary.inProgress += 1;
    } else {
      summary.pending += 1;
    }

    if (task.isOverdue) {
      summary.overdue += 1;
    }

    return summary;
  }, emptyTaskSummary());
}

function getTrackedHours() {
  const closedHours = demoTimesheets.reduce((total, entry) => total + entry.hours, 0);

  if (!runningTimer?.fromTime) {
    return closedHours;
  }

  const runningHours = (Date.now() - new Date(runningTimer.fromTime).getTime()) / 3600000;
  return Number((closedHours + runningHours).toFixed(2));
}

function getOverviewData(): OverviewData {
  const period = {
    fromDate: "2026-05-01",
    toDate: "2026-05-04"
  };
  const kpis = buildTaskSummary(tasksSeed);
  const recentClientVisits = demoTimesheets.filter((entry) => {
    const haystack = [entry.activityType, entry.taskSubject, entry.customerName, entry.projectName, entry.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes("visit");
  });

  return {
    employee: {
      employee: "EMP-0001",
      employeeName: "Demo Employee",
      userId: "employee@erpnext.local"
    },
    period,
    runningTimer,
    monthSummary: {
      trackedHours: getTrackedHours(),
      expectedHours: getExpectedHours(period.fromDate, period.toDate)
    },
    kpis,
    recentTasks: tasksSeed.slice(0, 4),
    recentClientVisits
  };
}

function getTimesheets(params: Record<string, string>) {
  const rows = [...(runningTimer ? [runningTimer] : []), ...demoTimesheets].filter((entry) => {
    if (!params.search) {
      return true;
    }

    const haystack = [entry.taskSubject, entry.customerName, entry.projectName, entry.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(params.search.toLowerCase());
  });

  return {
    period: {
      fromDate: "2026-05-01",
      toDate: "2026-05-04"
    },
    runningTimer,
    summary: {
      entries: rows.length,
      completedEntries: rows.filter((row) => !row.isRunning).length,
      totalHours: Number(demoTimesheets.reduce((total, row) => total + row.hours, 0).toFixed(2))
    },
    timesheets: rows
  };
}

function getCustomers(): { period: { fromDate: string; toDate: string }; customers: CustomerSummary[] } {
  const customerMap = new Map<string, CustomerSummary>();

  for (const task of tasksSeed) {
    const key = task.customerId || "no-customer";
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customerId: key,
        customerName: task.customerName || "No customer",
        customerGroup: task.customerGroup || "Uncategorized",
        taskCount: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        totalHours: 0
      });
    }

    const entry = customerMap.get(key)!;
    entry.taskCount += 1;

    if (["Completed", "Closed"].includes(task.status)) {
      entry.completed += 1;
    } else if (["Working", "In Progress"].includes(task.status)) {
      entry.inProgress += 1;
    } else {
      entry.pending += 1;
    }

    if (task.isOverdue) {
      entry.overdue += 1;
    }
  }

  for (const row of demoTimesheets) {
    const key = row.customerId || "no-customer";
    const entry = customerMap.get(key);
    if (entry) {
      entry.totalHours = Number((entry.totalHours + row.hours).toFixed(2));
    }
  }

  if (runningTimer?.customerId && customerMap.has(runningTimer.customerId)) {
    const entry = customerMap.get(runningTimer.customerId)!;
    const runningHours = (Date.now() - new Date(runningTimer.fromTime).getTime()) / 3600000;
    entry.totalHours = Number((entry.totalHours + runningHours).toFixed(2));
  }

  return {
    period: {
      fromDate: "2026-05-01",
      toDate: "2026-05-04"
    },
    customers: [...customerMap.values()].sort((left, right) => right.totalHours - left.totalHours)
  };
}

function getReports(reportKey?: string) {
  const reportKpis = getKpiCards();
  const kpiCards = reportKpis.kpis;
  const hoursByDay = reportKpis.hoursByDay;

  if (!reportKey) {
    return {
      period: {
        fromDate: "2026-05-01",
        toDate: "2026-05-04"
      },
      availableReports: reportDefinitions,
      summary: {
        kpiCards,
        hoursByDay
      }
    };
  }

  if (reportKey === "kpi_cards") {
    return {
      period: {
        fromDate: "2026-05-01",
        toDate: "2026-05-04"
      },
      availableReports: reportDefinitions,
      reportKey,
      kpiCards,
      hoursByDay
    };
  }

  if (reportKey === "hours_by_day") {
    return {
      period: {
        fromDate: "2026-05-01",
        toDate: "2026-05-04"
      },
      availableReports: reportDefinitions,
      reportKey,
      rows: hoursByDay
    };
  }

  if (reportKey === "leave_breakdown") {
    const leaveBreakdown = kpiCards.leavesTaken.breakdown || [];
    return {
      period: {
        fromDate: "2026-05-01",
        toDate: "2026-05-04"
      },
      availableReports: reportDefinitions,
      reportKey,
      summary: {
        kpiCards,
        hoursByDay
      },
      rows: leaveBreakdown.map((item) => ({
        leave_type: item.leaveType,
        days: item.days,
        applications: item.applications
      }))
    };
  }

  if (reportKey === "active_timer") {
    return {
      period: {
        fromDate: "2026-05-01",
        toDate: "2026-05-04"
      },
      availableReports: reportDefinitions,
      reportKey,
      rows: [
        {
          is_running: runningTimer ? true : false,
          live_hours: runningTimer?.liveHours ?? 0,
          task_subject: runningTimer?.taskSubject ?? "",
          customer_name: runningTimer?.customerName ?? "",
          from_time: runningTimer?.fromTime ?? ""
        }
      ]
    };
  }

  return {
    period: {
      fromDate: "2026-05-01",
      toDate: "2026-05-04"
    },
    availableReports: reportDefinitions,
    reportKey,
    rows: []
  };
}

function getKpiCards(): KpiCardsData {
  const summary = buildTaskSummary(tasksSeed);
  const tracked = Number(getTrackedHours().toFixed(2));
  const period = { fromDate: "2026-05-01", toDate: "2026-05-05" };
  const expected = getExpectedHours(period.fromDate, period.toDate);
  const delta = Number((tracked - expected).toFixed(2));
  const daysWorked = 3;
  void daysWorked;

  const liveHours = runningTimer
    ? Number(((Date.now() - new Date(runningTimer.fromTime).getTime()) / 3600000).toFixed(2))
    : 0;

  return {
    period,
    kpis: {
      tasksCompleted: { value: summary.completed, label: "Completed", color: "green" },
      tasksInProgress: { value: summary.inProgress, label: "In Progress", color: "blue" },
      tasksPending: { value: summary.pending, label: "Pending", color: "orange" },
      tasksOverdue: { value: summary.overdue, label: "Overdue", color: "red", alert: summary.overdue > 0 },
      hoursLogged: {
        value: tracked,
        label: "Hours Logged",
        color: "purple",
        subLabel: `of ${expected} expected at 7h/day`,
        delta,
        deltaLabel: `${delta >= 0 ? "+" : ""}${delta}h vs 7h/day standard`
      },
      visitCount: {
        value: 3,
        label: "Total Visits",
        color: "teal",
        visitBreakdown: [
          { customerId: "CUST-001", customerName: "Alpha Corp", visitCount: 2, visitDates: ["2026-05-02", "2026-05-05"] },
          { customerId: "CUST-002", customerName: "Beta Ltd", visitCount: 1, visitDates: ["2026-05-04"] }
        ]
      },
      leavesTaken: {
        value: 0.5,
        label: "Leaves Taken",
        color: "gray",
        breakdown: [{ leaveType: "Sick Leave", days: 0.5, applications: 1 }]
      },
      activeTimer: {
        isRunning: runningTimer !== null,
        liveHours,
        taskSubject: runningTimer?.taskSubject ?? null,
        customerName: runningTimer?.customerName ?? null,
        fromTime: runningTimer?.fromTime ?? null
      }
    },
    hoursByDay: [
      { date: "2026-05-01", hours: 3.5 },
      { date: "2026-05-02", hours: 2.5 },
      { date: "2026-05-04", hours: 1.75 },
      { date: "2026-05-05", hours: liveHours }
    ]
  };
}

function startTimer(params: Record<string, string>) {
  const task = tasksSeed.find((item) => item.taskId === params.task);

  if (!task) {
    return {
      success: false,
      action: "start_timer",
      data: null,
      error: "Task not found"
    };
  }

  if (runningTimer) {
    return {
      success: false,
      action: "start_timer",
      data: { runningTimer },
      error: "A timer is already running"
    };
  }

  runningTimer = {
    timesheetDetailId: `TSD-RUN-${Date.now()}`,
    timesheetId: `TS-RUN-${Date.now()}`,
    task: task.taskId,
    taskSubject: task.subject,
    owner: "employee@erpnext.local",
    userId: "employee@erpnext.local",
    employee: "EMP-0001",
    employeeName: "Demo Employee",
    customerId: task.customerId || undefined,
    customerName: task.customerName || undefined,
    project: task.project || undefined,
    projectName: task.projectName || undefined,
    activityType: "Working",
    notes: params.notes || "",
    fromTime: isoNowText(),
    toTime: null,
    hours: 0,
    isRunning: true
  };

  return {
    success: true,
    action: "start_timer",
    data: {
      message: "Timer started successfully",
      runningTimer
    },
    error: null
  };
}

function stopTimer() {
  if (!runningTimer) {
    return {
      success: false,
      action: "stop_timer",
      data: null,
      error: "No running timer found"
    };
  }

  const hours = Number(((Date.now() - new Date(runningTimer.fromTime).getTime()) / 3600000).toFixed(2));

  demoTimesheets = [
    {
      ...runningTimer,
      toTime: isoNowText(),
      hours,
      isRunning: false
    },
    ...demoTimesheets
  ];

  runningTimer = null;

  return {
    success: true,
    action: "stop_timer",
    data: {
      message: "Timer stopped successfully",
      runningTimer: null
    },
    error: null
  };
}

function createManualTimesheet(params: Record<string, string>) {
  const task = tasksSeed.find((item) => item.taskId === params.task);
  if (!task) {
    return {
      success: false,
      action: "create_manual_timesheet",
      data: null,
      error: "Task not found"
    };
  }

  if (!params.from_time || !params.to_time) {
    return {
      success: false,
      action: "create_manual_timesheet",
      data: null,
      error: "from_time and to_time are required"
    };
  }

  const from = new Date(params.from_time.replace(" ", "T"));
  const to = new Date(params.to_time.replace(" ", "T"));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return {
      success: false,
      action: "create_manual_timesheet",
      data: null,
      error: "Invalid time range"
    };
  }

  const hours = Number(((to.getTime() - from.getTime()) / 3600000).toFixed(2));
  const idSuffix = Date.now().toString();
  demoTimesheets = [
    {
      timesheetDetailId: `TSD-MAN-${idSuffix}`,
      timesheetId: `TS-MAN-${idSuffix}`,
      task: task.taskId,
      taskSubject: task.subject,
      owner: "employee@erpnext.local",
      userId: "employee@erpnext.local",
      employee: "EMP-0001",
      employeeName: "Demo Employee",
      customerId: task.customerId || undefined,
      customerName: task.customerName || undefined,
      project: task.project || undefined,
      projectName: task.projectName || undefined,
      activityType: params.activity_type || "Working",
      notes: params.notes || "",
      fromTime: params.from_time,
      toTime: params.to_time,
      hours,
      isRunning: false
    },
    ...demoTimesheets
  ];

  return {
    success: true,
    action: "create_manual_timesheet",
    data: {
      message: "Manual timesheet entry created"
    },
    error: null
  };
}

export function handleDemoAction(action: string, params: Record<string, string>) {
  if (action === "overview") {
    return {
      success: true,
      action,
      data: getOverviewData(),
      error: null
    };
  }

  if (action === "tasks") {
    const filteredTasks = getFilteredTasks(params);
    return {
      success: true,
      action,
      data: {
        summary: buildTaskSummary(filteredTasks),
        tasks: filteredTasks
      },
      error: null
    };
  }

  if (action === "timesheets") {
    return {
      success: true,
      action,
      data: getTimesheets(params),
      error: null
    };
  }

  if (action === "customers") {
    return {
      success: true,
      action,
      data: getCustomers(),
      error: null
    };
  }

  if (action === "reports") {
    return {
      success: true,
      action,
      data: getReports(params.report_key),
      error: null
    };
  }

  if (action === "kpi_cards") {
    return { success: true, action, data: getKpiCards(), error: null };
  }

  if (action === "start_timer") {
    return startTimer(params);
  }

  if (action === "stop_timer") {
    return stopTimer();
  }

  if (action === "create_manual_timesheet") {
    return createManualTimesheet(params);
  }

  return {
    success: false,
    action,
    data: null,
    error: `Unsupported action: ${action}`
  };
}
