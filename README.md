# Canvas Kit Demo, rebuilt on Workday Extend

A port of the React [Canvas Kit component showcase](https://github.com/zachmichael/workdayCanvasKitDemo)
to a Workday Extend app: same premise, eight pages, every page showing live widgets.

This is **app source, not a running site.** An Extend app is JSON metadata interpreted by the
Workday UI engine inside a tenant. There is no localhost and no static host — it is deployed to a
Development tenant through App Builder or WDCLI. Nothing here has been run in a tenant; see
[Verification](#verification) for exactly what was and was not checked.

## Layout

The app bundle lives in `canvasKitDemoExtend/` and contains **only** app content, so it can be
uploaded as-is. Repo furniture — this README, the checks, `.gitignore` — stays at the repo root and
outside the bundle. That mirrors a tenant download, which is `appManifest.json` plus component
directories and nothing else.

```
README.md                              not part of the bundle
tools/                                 not part of the bundle; the checks described below
canvasKitDemoExtend/                   <- the uploadable app bundle
  appManifest.json                     referenceId + display name
  model/
    ManageTimeOff.securitydomain       secures the object and both time-off pages
    TimeOffRequest.businessobject      persistent object; generates a REST collection
    AllTimeOffRequests.report          delivered report over the object
    RequestTimeOff.task                exposes /forms as a searchable Workday task
    ViewTimeOffRequests.task           exposes /myRequests likewise
  presentation/
    canvasKitDemoExtend.smd            site metadata: auth schemes
    canvasKitDemoExtend.amd            app metadata: tasks, routingPatterns, dataProviders
    home.pmd                           landing page and the React/Extend mapping table
    buttons.pmd                        button, buttonGroup, dropDownButton, pageActionButton
    forms.pmd                          text, dropdown, date, number, checkBox, radioGroup, currency
    workerDirectory.pmd                grid with sorting, filtering, paging
    myRequests.pmd                     reads the persisted requests back
    feedback.pmd                       inline messages, progressIndicator, guide, congratulationsPopup
    navigation.pmd                     tabs, dropDownButton menu, the routing table
    charts.pmd                         clusteredBarChart2, donutChart2, accessibility mode
    scripting.pmd                      PMD script vs JavaScript, live derived values
    pods/                              header (back link) and footer, shared by every page
    scripts/                           workerData (the employees.ts port), scriptingDemos
```

There is no `orchestration/`, because nothing here runs server-side. Apps ship only the directories
they use rather than empty placeholders — `chartDictionary` is presentation-only, `learningEnrollments`
is orchestration-only, `capitalProjectPlanning` has all four.

## The model layer

The showcase pages are self-contained and read local data. Two pages are different: `forms.pmd`
writes a real `TimeOffRequest`, and `myRequests.pmd` reads them back. That exists to exercise the
parts of Extend a pure widget gallery never touches — persistence and security.

What the five model files buy, none of which is page code:

| Component | What the platform generates from it |
| --- | --- |
| `TimeOffRequest.businessobject` | A persistent object, a REST collection at `app/v1/timeOffRequests`, and a report data source |
| `ManageTimeOff.securitydomain` | A domain securing the object and both pages, granted to security groups in the tenant |
| `AllTimeOffRequests.report` | A delivered report, including the derived fields |
| `RequestTimeOff.task`, `ViewTimeOffRequests.task` | Make the two routes searchable Workday tasks rather than only URLs |
| `derivedFields` | `requiresSecondApproval` and `lengthBand`, computed by the platform |

Three things here have no Canvas Kit counterpart at all:

**`valueOutBinding`.** In React you read state and assemble the request body yourself. Here each
widget declares its own path into the outbound payload and the platform assembles it.

**`onSend`.** Fields the page must not be trusted to supply — the worker, the status, the reference
id — are stamped server-side on the way out, not gathered from inputs.

**`secureByTarget`.** The `worker` field delegates contextual security to the target instance, so a
user sees only requests for workers they are secured to. That filtering is a field attribute, not a
`WHERE` clause and not a `filter()` in page code.

## How the two apps correspond

| React + Canvas Kit | Workday Extend |
| --- | --- |
| `CanvasProvider` + `BrowserRouter` | `.smd` + `.amd` `tasks[]` with `routingPattern` |
| A component: `<PrimaryButton>` | A widget tag: `{"type": "button", "action": "PRIMARY"}` |
| `AppShell.tsx` sidebar | `home.pmd` links + `header.pod` on each page |
| `DemoSection` show-code toggle | `pageActionButton` flipping a `section.visible` |
| `employees.ts` | `scripts/workerData.script` |
| `useState`, `useMemo` | values read and written inside `<% %>` |
| `createStencil`, design tokens | nothing — the UI engine owns styling |

## What did not survive the port

These are the honest gaps, not stylistic choices.

**The Design Tokens page has no counterpart.** Canvas Kit's whole premise is that you control
styling through tokens and a styling API. Extend's premise is the opposite: an app declares what a
page contains and never how it looks, so the tenant's theme stays consistent. There is nothing to
showcase. A charts page and a scripting page take its place — both chosen because they show what
you get *in exchange* for giving up that control.

**Buttons have no disabled state.** `button` exposes `visible` and `render`, not `enabled`. A
button that should not be pressable is hidden rather than greyed out. That is a behavioural
difference, not a naming one.

**No Toast, no Banner, no Modal, no Skeleton, no Breadcrumbs, no SegmentedControl.** Transient and
blocking feedback in Extend are *page transitions* declared as AMD flows, not components you drop
into a tree. `feedback.pmd` shows what genuinely exists in-page: messages you show and hide,
`progressIndicator`, a field-attached `guide`, and `congratulationsPopup`.

**Sorting, filtering and paging are free.** The React `DataPage` spent ~60 lines on `useState` and
`useMemo` to get a sortable, filterable, paged table. In Extend that is `sortableAndFilterable` on
each column plus `autoPaging` on the grid. This is the one place the Extend version is markedly
smaller.

**There is no caution field state.** Canvas Kit's `FormField` has error and caution; Extend has
`required` and `helpText`.

## PMD script is not JavaScript

The `.script` modules read like JS and are not. The differences that actually cost time, all
confirmed against `reference/api/pmd-scripting/syntax.md`:

| | JavaScript | PMD script |
| --- | --- | --- |
| Empty map | `{}` | `{:}` — `{}` declares a **Set** |
| For-each | `for (const x of list)` | `for (let x : list)` — colon |
| Emptiness | `list.length === 0` | `empty(list)` — a function |
| Size | `str.length` | `size(str)` |
| Interpolation | `` `Hi ${name}` `` | `` `Hi {{name}}` `` |
| Logical and | `&&` or `and` | `&&` only; `and` is reserved |

## Data

All data is local, in `scripts/workerData.script` — the same twelve fictional workers as the React
app. Nothing calls a Workday API, so the app needs no domain security grants to render.

To swap the directory onto real data, add an endpoint to
`canvasKitDemoExtend/presentation/workerDirectory.pmd` and point the grid at it:

```json
"endPoints": [
  { "name": "workers", "baseUrlType": "wdayCom", "url": "/workers", "authType": "sso" }
]
```

then change the grid's `rows` to `<% workers.data %>`. The `wdayCom` provider is already declared
in the AMD. That call runs under the caller's own security, so what comes back depends on their
security groups.

## Verification

Two checks ship in `tools/`. Both pass. Run them from the repo root:

```bash
node tools/validate.mjs
```

It defaults to the `canvasKitDemoExtend/` bundle and `../extendreference/reference`; pass both as
arguments to override. It exits non-zero if either path is missing, so a misconfigured run fails
loudly rather than passing on an empty set.

Presentation:

- every `.pmd` / `.pod` / `.amd` / `.smd` parses as **strict** JSON
- every `"type"` is one of the 124 known widget types
- every attribute is documented for that widget in `widget-attrs.json`
- every `taskReference.taskId` resolves to an AMD task, every page is routed, every `include` and
  `podId` resolves, every file is under the 100 KB component limit

Model:

- field types are real (`TEXT`, `RICH_TEXT`, `DATE`, `CURRENCY`, `BOOLEAN`, `INTEGER`, `DECIMAL`,
  `SINGLE_INSTANCE`, `MULTI_INSTANCE`), `SINGLE_INSTANCE` fields have a `target`, field ids are unique
- the B200/B201/B203 limits Extend enforces at deploy: at most one `useForDisplay`, one
  `isReferenceId`, one `secureByTarget` per object
- derived fields are not `CURRENCY` or `SINGLE_INSTANCE`; component ids are integers 1..32767
- report columns and sort fields name real fields; every `securityDomain` referenced from a model
  component or a PMD is defined; a model `.task` `routePath` matches an AMD `routingPattern`; an
  `app`-provider endpoint targets a real `defaultCollection`

All 11 model rules were negative-control tested — each defect injected individually, each caught,
tree restored clean.

```bash
node tools/lint-script.mjs
```

- flags the JavaScript-isms above in `.script` modules

**What is not verified:** the app has never been deployed. Nothing here has been rendered, and no
runtime behaviour — script evaluation, `onChange` wiring, chart binding, tab behaviour — has been
exercised. Static checks catch wrong widget names and undocumented attributes; they cannot catch a
widget that renders but does the wrong thing. Treat the first tenant deploy as the real test.

Worth knowing: Extend's own parser tolerates non-strict JSON (about 22% of Workday's published
sample artifacts fail `JSON.parse`, mostly from multi-line `<% %>` blocks). This app is held to
strict JSON anyway, which is why every `onClick` here is a single line.

## Provenance

Built against the condensed reference and sample corpus in `../extendreference` — in particular
Workday's own `pmdWidgetDictionary` and `chartDictionary` apps, which were used as fidelity
references for widget idiom. No sample content is copied; every file here is original.
