# HansaWorld Chat, Mail & Conference -- Deep-Dive Findings

> **Source**: HAL codebase (`legacy-src/c8520240417/`), `amaster/haldefs.h`, HansaManuals documentation
> **Date**: 2026-02-15
> **Scope**: Chat (internal + web live chat + Anna2 AI), Mail (internal + external email), Conference/Confirmation, Asterisk/VOIP, SMS

---

## 1. Chat System

### 1.1 Chat Log Register (`ChatLogVc`)

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned serial number (via `NextSerNr`) |
| `StartDate` | Date | Defaults to `CurrentDate` on creation |
| `StartTime` | Time | Defaults to `CurrentTime` on creation |

**Row fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Person` | String | Username/person who sent the chat message |
| `ChatText` | String | The text content of the chat message |

**Indexes:** `SerNr`

**Workflow:**
- On new record: `StartDate = CurrentDate`, `StartTime = CurrentTime`, `SerNr` auto-assigned
- Chat log iterates rows via `MatRowGet/MatRowPut` pattern (matrix rows)

### 1.2 External Chat Users Register (`ExtChatUsersVc`)

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `IDNr` | LongInt | Unique ID, auto-assigned (`NextChatID` finds max IDNr + 1) |
| `UserMailboxName` | String | Internal mailbox name of the chat operator (required, validated on check) |
| `Status` | Integer | Status flag -- `1` = active/available for web chat |
| `Comment` | String | Descriptive comment about the chat operator |
| `Languages` | String | Languages supported by the operator |
| `Country` | String | Country of the operator |

**Indexes:** `IDNr`, `Status`

**Validation:**
- `UserMailboxName` must be non-blank (error 1058 on empty)
- `IDNr` auto-generated as `max(IDNr) + 1`

### 1.3 Web Chat (Live Chat -- HBS Div and WebNG)

**Two implementations exist:**

#### 1.3.1 Classic HBS Div Chat (`WebHBSDivChat.hal`)

- **Frameset-based**: Uses HTML frames (ChatFrame for messages, ChatEntryFrame for input)
- **Login required**: `WebLoginStatus == 3`
- **Flow**:
  1. `WebHBSDivChat` -- Lists online chat operators from `ExtChatUsersVc` where `Status=1` and `UserOnline()` is true
  2. `WebHBSDivChatInitiate` -- Creates a chat session via `ChatCreate(mailboxName)`; returns a `chatid`
  3. `WebHBSDivChatIndex` -- Displays frameset with text frame + entry frame
  4. `WebChatTextFrame` -- Renders chat messages using `ChatTextRowCnt`/`ChatGetUsrText`/`ChatGetTheText`
  5. `WebChatEntryFrame` -- Input form that posts to text frame
- **Built-in functions** (C-level): `ChatCreate`, `ChatAddText`, `ChatTextRowCnt`, `ChatGetUsrText`, `ChatGetTheText`

#### 1.3.2 WebNG Live Chat (`WebNGElementLiveChat.hal` + `WebNGLiveChat.js`)

- **AJAX-based**: Single-page element, JavaScript polling
- **JSON responses** with `objtype` field
- **Actions** (via `LiveChatAction`):
  - `createchat` -- Finds first online operator from `ExtChatUsersVc` (Status=1), calls `ChatCreate`, stores `chat_id` in session
  - `closechat` -- Closes chat session
  - `postmsg` -- Adds text to chat via `ChatAddText(chatid, msg)`
  - `getmsgs` -- Returns new messages since `lastline` as JSON array with `user` and `text` fields
- **Agent concealment**: `LiveChatConcealUser` replaces real usernames with "Agent", "Agent 2", etc. for web visitors
- **Session state**: `chat_id`, `chat_users` (count), `chat_user_N` stored in session strings

### 1.4 Anna2 AI Chatbot Integration

**Registers:**
| Register | Purpose |
|----------|---------|
| `Anna2ContextVc` | Conversation context storage -- rows store `role:user`/`role:assistant` messages (Base64 encoded) and `parameter:X` values |
| `Anna2ChatNodeVc` | Decision tree nodes -- defines intent routing, parameters, answers |
| `AIChatVc` | Chat window record with `SpeakFlag` for text-to-speech |
| `Anna2SettingsBlock` | Settings block: `AnnaDebugLog`, `CtxDebug`, `LLMDebug`, `IntentDebug`, `PerfDebug` |
| `TalkBotIntentVc` | Intent definitions with `Code` and `IntentLLMDescription` |
| `ScoredIntentVc` | Scored intents from AI scoring (`Intent`, `Score`, `ExampleString`) |
| `ScoredCodeVc` | Scored entity codes from AI matching (`TagCode`, `Score`, `ExampleString`) |
| `OpenAILogVc` | Debug log records for AI interactions |

**Architecture:**
- **Node-based decision tree**: Each node has `SerNr`, `Intent`, `MainKey`, `TryCount`
- **Node stack**: Array of nodes representing current conversation path
- **Context storage**: Parameters stored as `parameter:paramid` rows with Base64 values

**AI/LLM Integration:**
- Uses local LLM via `LLM_Init(LlamaModel, instruction, "grammar-json.gbnf")`
- Default model: `llama-2-7b-chat/ggml-model-q4_0.gguf`
- **Parameter extraction**: Sends conversation context + prompt to LLM, expects JSON response with parameter values
- **Intent validation**: Two-stage scoring: (1) `AI_ScoreIntents` for initial matching, (2) LLM-based `IntentIsCorrect` for confirmation
- **Intent cutoff**: Score > 0.8 required

**Business Actions (via chatbot):**
| Action | Function | Description |
|--------|----------|-------------|
| Add item to order | `A2CProc_OR_AddItem` | Extracts item, qty, customer, order# from chat; creates order row |
| Email order | `A2CProc_OR_Email` | Creates mail from order via `CreateMailFromORD`, sets `SendFlag=1` |
| Create order | `A2CProc_OR_Create` | Creates new order for customer via `RecordNew/RecordStore` |
| List deliverable orders | `A2CProc_OR_GetDeliverable` | Lists open, shippable orders for customer |
| Planned delivery date | `A2CProc_OR_PlannedDelivery` | Returns planned delivery date for order |
| Add item to quotation | `A2CProc_QT_AddItem` | Adds item to quotation |
| Email quotation | `A2CProc_QT_Email` | Creates mail from quotation via `CreateMailFromQTD` |

**Features:**
- **Text-to-speech**: `CloudTextToSpeech("en", message, "%LOCALSPEAKER%")`
- **Whisper (speech-to-text)**: `Anna2ChatWClass_WhisperText` / `WhisperDone`
- **Debug windows**: Separate debug views for scores, LLM, state, timings
- **Parameter validation**: `ValidateItem` (AI entity matching via `AI_ScoreTaggedCodes`), `ValidateQuantity`, `ValidateCUVc`, `ValidateORVc`, `ValidateQTVc`, `ValidateIVVc`

### 1.5 Chat Reports

| Report | Description |
|--------|-------------|
| `ChatHistoryRn` | Chat history report (delegates to C report engine) |
| `GlobalChatHistoryRn` | Global chat history across all users |
| `ChatLogRn` | Chat log report -- iterates `ChatLogVc` by `SerNr` index, outputs serial number, date, person, chat text per row |
| `SkypeCallHistoryRn` | Skype/VOIP call history |
| `SkypeMessageCountRn` | Skype message count statistics |

### 1.6 Chat Window Actions

- `ChatWhoWsm` -- Runs "ChatWhosOnRn" report (who's online in chat)

---

## 2. Mail System

### 2.1 Mail Register (`MailVc`)

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned serial number (defaults to `-1` for new) |
| `Header` | String | Mail subject line |
| `TransDate` | Date | Transaction date (set on save/update to `CurrentDate`) |
| `TransTime` | Time | Transaction time |
| `SendFlag` | Integer | 0 = draft, non-zero = sent |
| `LockedFlag` | Integer | 0 = unlocked, non-zero = locked (prevents editing) |
| `HtmlFlag` | Integer | 0 = plain text, non-zero = HTML mail |
| `HtmlTemplate` | String | Code referencing `HtmlTemplateVc` |
| `Priority` | Integer | Priority level (0 = normal; non-zero shown in `UserPrio` index) |
| `Lifespan` | Integer | 0 = normal, 1 = keep forever, 2 = mark for deletion, -1000 = special processing flag |
| `SignAddedf` | Integer | Whether email signature has been added |
| `IsComment` | Boolean | Whether this mail is a comment/annotation |
| `IsBounce` | Integer | Whether this is a bounce message |
| `IsList` | Integer | Whether this is a mailing list message |
| `AutoSubmitted` | Integer | Whether auto-generated (prevents auto-reply loops) |
| `RequireAcceptance` | Integer | Whether recipients must accept/acknowledge |
| `Tags` | String | Comma-separated tag set |
| `Folder` | String | Folder assignment within mailbox |

**Row fields (recipient matrix):**
| Field | Type | Description |
|-------|------|-------------|
| `RowTyp` | Integer | Row type enum (see below) |
| `AddrCode` | String | Mailbox name, conference name, or email address |
| `Mailbox` | LongInt | Resolved mailbox serial number (`-1` = unresolved) |
| `AddrStatus` | Integer | Status per recipient (0=active, 1=deleted/handled) |
| `AddrFolder` | String | Folder within the recipient's mailbox |

**Text body**: Stored as record text field (line-based or HTML)

**Row type enum (`kMailRowType`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kMailRowTypeTo` | 0 | To recipient |
| `kMailRowTypeFrom` | 1 | From sender |
| `kMailRowTypeFile` | 2 | File attachment reference |
| `kMailRowTypeCC` | 3 | CC recipient |
| `kMailRowTypeBCC` | 4 | BCC recipient |

**Indexes:** `SerNr` (main), `UserSer:{mailboxNr}`, `UserTime:{mailboxNr}`, `UserSubject:{mailboxNr}`, `UserPrio`

### 2.2 Mail Status Tracking (`MailReadVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `mailSerNr` | LongInt | Mail serial number |
| `mailBoxNr` | LongInt | Mailbox serial number |
| `accode` | Integer | Status code (enum below) |
| `fDate` | Date | Status change date |
| `fTime` | Time | Status change time |

**Indexes:** `accode` (composite key: `mailSerNr` + `accode`), `mailNrmailBoxNr`, `userCode`

**Mail status enum (`kMailStatus`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kMailStatusRead` | 0 | Read by recipient |
| `kMailStatusDeleted` | 1 | Deleted from mailbox |
| `kMailStatusCreated` | 2 | Newly created |
| `kMailStatusUpdated` | 3 | Updated/modified |
| `kMailStatusUnread` | 4 | Not yet read |
| `kMailStatusQueued` | 5 | Queued for sending |
| `kMailStatusRouted` | 6 | Routed to internet |
| `kMailStatusPrinted` | 7 | Printed |
| `kMailStatusReadByExternal` | 8 | Read receipt from external |
| `kMailStatusPostponed` | 9 | Acceptance postponed |
| `kMailStatusAccepted` | 10 | Accepted |
| `kMailStatusRejected` | 11 | Rejected |
| `kMailStatusSMTPError` | 12 | SMTP sending error |

### 2.3 Mail Business Logic

**Record lifecycle:**

1. **Defaults**: `SerNr = -1`, `SendFlag = 0`, row 0 set to `kMailRowTypeFrom` with current user's mailbox name
2. **Check** (`MailVcRecordCheck`):
   - Row 0 must be `kMailRowTypeFrom` with non-blank `AddrCode`
   - All `AddrCode` values validated: must be valid mailbox names or valid email addresses
   - No duplicate addresses allowed
   - Conference recipients must be non-folder conferences
   - HTML template validated if set
   - File uploads must be fully complete before sending
   - External recipients validated for email format
   - Cannot un-send if queued or routed
3. **Save** (`MailVcRecordSave`):
   - Sets `TransDate/TransTime` to current
   - Resolves all mailbox numbers (`ResolveMailboxes`)
   - Checks for auto-reply triggers if sent
4. **Save After** (`MailVcRecordSaveAfter`):
   - `TestAndDeleteMail` -- removes mail if all recipients have deleted/handled it and no record links exist
   - Creates activity for customer (`CreateActivityforCustomer_Mail`) if sent
5. **Update** (`MailVcRecordUpdate`):
   - Updates `TransDate/TransTime` unless tags-only change or `gMailVcDoNotUpdateDatef` is set
   - `UpdateMailboxes` -- re-resolves changed addresses
   - Checks auto-reply on send
   - If un-sending internet mail, redirects to postmaster
6. **Update After** (`MailVcRecordUpdateAfter`):
   - `TestAndDeleteMail`
   - Updates record links if header changed
   - Creates activity if newly sent
7. **Duplicate** (forward): Sets new `SerNr=-1`, `SendFlag=0`, converts From to To, calls `SetMailForward`
8. **Remove Test**: Allows deletion (shows warning message 1359)
9. **Remove After**: Deletes all associated `MailReadVc` records

**Auto-reply system:**
- Triggered on incoming mail for recipients with activated `ConfAutoReplyVc`
- Anti-loop: Skips if `AutoSubmitted`, `IsBounce`, or `IsList` flag set
- Rate limiting: Max 3 auto-replies per sender per day via `AutoReplyListVc`
- Creates `EMailQueVc` record for auto-reply with original text quoted
- Supports forwarding to external address (`ForwardTo` field, `ForwardEnabled`)

**Signature system:**
- `ConfSignVc` register stores email signatures per mailbox
- Signatures can be plain text or HTML (with file attachments)
- Added during `EMailQueVc` record save, not on `MailVc` save
- `SignAddedf` flag prevents double-adding

### 2.4 Email Queue (`EMailQueVc`)

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned |
| `OrgSerNr` | LongInt | Original mail serial number |
| `FileName` | String | Source register name (e.g., "MailVc") |
| `Header` | String | Email subject |
| `MessageID` | String | Internet message ID |
| `TransDate` | Date | Original date |
| `TransTime` | Time | Original time |
| `QueDate` | Date | Queue date |
| `QueTime` | Time | Queue time |
| `HtmlFlag` | Integer | HTML flag |
| `HtmlTemplate` | String | HTML template code |
| `HasFileAtt` | Integer | Has file attachments |
| `HasRecAtt` | Integer | Has record attachments |
| `Priority` | Integer | Sending priority |
| `EMailSent` | Integer | Sending status (`kEMailQueueSent` = sent) |
| `Lifespan` | Integer | Lifespan control |
| `AutoSubmitted` | Integer | Auto-submitted flag (for auto-replies) |
| `SignAddedf` | Integer | Signature added flag |

**Row fields:** Same as `MailVc` (`RowTyp`, `AddrCode`)

**Indexes:** `Sending` (key: `EMailSent`)

**On save:**
- `SerNr` auto-assigned via `NextSerNr`
- Signature added via `AddSignature`
- HTML template files copied via `CopyTemplateFilesToEMailQuer`

### 2.5 Mail Filter Register (`MailFilterVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned |
| `MailBox` | LongInt | Mailbox to filter (defaults to -1 for global) |

Provides rule-based filtering of incoming mail. Further filter criteria are in the matrix rows (not fully exposed in HAL -- likely configured in the C core).

### 2.6 Mail Text Templates (`MailTextVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `FileName` | String | Template filename |
| `Register` | String | Source register name (auto-populated from register set) |
| `Header` | String | Email subject template |
| `FirstTxt` | String | Code for opening text block (`LTxtVc`) |
| `LastTxt` | String | Code for closing text block (`LTxtVc`) |

Used by `ActToMailMn`, `IVToMailMn` and other document-to-mail routines to compose emails from business documents.

### 2.7 HTML Templates (`HtmlTemplateVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | Unique code (required, validated on check) |

Used for HTML mail formatting. Has record-linked files including `body.html`. Files are copied to outgoing `EMailQueVc` on send.

### 2.8 Mail Folders (`MailFolderVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Name` | String | Folder name |
| `MailBox` | String/LongInt | Owning mailbox identifier |

Provides sub-folder organization within a mailbox. Window subset encodes `mailboxNr:folderName`.

### 2.9 Local Mail (Internal Messaging -- `LocalMailVc`)

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned |
| `seqnr` | LongInt | Sequence number (defaults to -1) |
| `TransDate` | Date | Updated on save |
| `TransTime` | Time | Updated on save |
| `copyf` | Integer | 0 = original, 1 = copy (for sent items) |

**Row fields:**
| Field | Type | Description |
|-------|------|-------------|
| `RowTyp` | Integer | Same as MailVc (1 = From) |
| `AddrCode` | String | Mailbox name |

**Indexes:** `UserSerNr`, `UserSubject`, `UserTime`, `Copy`

**Workflow:**
- Defaults: Row 0 set to From with current user's mailbox
- On update: If `seqnr > 0`, saves a copy of the previous version (`SaveCopyMail`)
- Copy records are excluded from main indexes and shown separately

### 2.10 SMS Register (`SMSVc`)

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned |
| `SendFlag` | Integer | Set to 1 on save |
| `TransDate` | Date | Current date |
| `TransTime` | Time | Current time |
| `Person` | String | Current user code |
| `FromPhoneNo` | String | Sender phone (from GlobalUser.CustCode.Mobile -> User.CustCode.Mobile -> User.Phone1/2) |
| `MessageType` | Integer | Type enum |
| `CheckSum` | Val | Cleared on duplicate |

**On save:** Auto-sets `SendFlag=1`, resolves `FromPhoneNo` from user/customer records, queues via `AddToETasksQueueVc("SENDSMS", "SMSVc", SerNr, 1)` if `MessageType == kComMessageTypeSms`

**Message type enum (`kComMessageType`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kComMessageTypeSms` | 0 | SMS message |
| `kComMessageTypeSkypeChat` | 1 | Skype chat message |
| `kComMessageTypeSkypeCall` | 2 | Skype call |

**Message sub-type enum (`kComMessageSubType`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kComMessageSubTypeNotDefined` | -1 | Undefined |
| `kComMessageSubTypeSetTopic` | 0 | Topic set |
| `kComMessageSubTypeSaid` | 1 | Message said |
| `kComMessageSubTypeSawMembers` | 2 | Members seen |
| `kComMessageSubTypeCreatedChatWith` | 3 | Chat created |
| `kComMessageSubTypeLeft` | 4 | User left |
| `kComMessageSubTypePostedContacts` | 5 | Contacts posted |
| `kComMessageSubTypeGapInChat` | 6 | Gap in chat |
| `kComMessageSubTypeSetRole` | 7 | Role changed |
| `kComMessageSubTypeKicked` | 8 | User kicked |
| `kComMessageSubTypeKickBanned` | 9 | User kick-banned |
| `kComMessageSubTypeSetPicture` | 10 | Picture set |
| `kComMessageSubTypeSetGuideLines` | 11 | Guidelines set |
| `kComMessageSubTypeUnknown` | 12 | Unknown |
| `kComMessageSubTypeSetEmoted` | 13 | Emote sent |
| `kComMessageSubTypeAddedMembers` | 14 | Members added |
| `kComMessageSubTypeIncomingPSTN` | 15 | Incoming PSTN call |
| `kComMessageSubTypeOutgoingPSTN` | 16 | Outgoing PSTN call |
| `kComMessageSubTypeIncomingP2P` | 17 | Incoming P2P call |
| `kComMessageSubTypeOutgoingP2P` | 18 | Outgoing P2P call |

---

## 3. Conference/Confirmation System

### 3.1 Conference Register (`ConfVc`)

The Conference register serves a **dual purpose**: it defines both mailboxes (one per user) and shared conferences/newsgroups/libraries.

**Header fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-assigned; `-1` reserved for "Mailboxes" root folder |
| `AddrName` | String | Unique address name (conference name or mailbox name) -- **required** |
| `AddrCode` | String | Associated user code (only for mailbox class; must be blank for conferences) |
| `Comment` | String | Description/comment |
| `Class` | Integer | Conference class enum (see below) |
| `MotherConf` | LongInt | Parent conference/folder SerNr (`-1` for mailboxes, `0` for top-level conferences) |
| `Closed` | Integer | 0 = open, non-zero = closed |
| `MaxMail` | LongInt | Max messages (-1 = inherit from settings) |
| `MaxReadDays` | LongInt | Max age for read messages (-1 = inherit) |
| `MaxUnreadDays` | LongInt | Max age for unread messages (-1 = inherit, mailbox only) |
| `UserType` | Integer | User license level (1/2/3) for mailbox class |
| `DefaultHtmlFlag` | Integer | Default HTML mode for new messages |
| `ForceHtmlFlag` | Integer | Force HTML/plain text mode |
| `RequireTemplate` | Integer | Require HTML template for new messages |
| `DefaultTemplate` | String | Default HTML template code |
| `ForceDefaultTemplate` | Integer | Force default template |

**Row fields (access groups):**
| Field | Type | Description |
|-------|------|-------------|
| `Group` | String | Access group name |

**Indexes:** `SerNr` (main), `AddrName`, `AddrCode`, `ActAddrName` (active non-closed, non-folder), `SubConfAddrName:{motherConf}`

**Conference class enum (`kConfClass`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kConfClassConference` | 0 | Standard conference (shared discussion) |
| `kConfClassNews` | 1 | News/announcements |
| `kConfClassBillboard` | 2 | Billboard/notice board |
| `kConfClassLibrary` | 3 | Document library |
| `kConfClassFolder` | 4 | Folder container (no messages, contains sub-conferences) |
| `kConfClassMailbox` | 5 | User mailbox (1:1 with user) |
| `kConfClassArchive` | 6 | Archive (stores record link attachments) |

**Validation (`ConfVcRecordCheck`):**
- Mailboxes require `AddrCode` (user code); conferences must have blank `AddrCode`
- `AddrName` must be unique across all mailboxes
- Cannot rename a non-empty mailbox
- Cannot change class of a non-empty conference/folder/archive
- Mailbox `MotherConf` must be `-1`
- User license limits enforced: checks `Level1`, `Level2`, `Level3`, `Mailboxes`, `ThinClients`, `NamedBPUsers` against `ModuleBlock`
- Conference count limit checked against `mt.Conferences`

**On save:** `SerNr` auto-assigned (unless `AddrName == "Mailboxes"` in which case `SerNr = -1`)

**Removal rules:**
- Conference: only if mailbox is empty (`RecordsInIndex == 0`)
- Folder: only if no sub-conferences
- Archive: only if no record link attachments

### 3.2 Conference Access (`ConfAccVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | User/group code |
| `AccLevel` | Integer | Access level enum |

**Access level enum (`kAccessLevel`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kAccessLevelDummy` | 0 | Not set |
| `kAccessLevelFull` | 1 | Full access (read/write/delete) |
| `kAccessLevelReadOnly` | 2 | Read only |
| `kAccessLevelReadNew` | 3 | Read new messages only |
| `kAccessLevelLimited` | 4 | Limited access |
| `kAccessLevelNone` | 5 | No access |
| `kAccessLevelBrowse` | 6 | Browse only |
| `kAccessLevelBrowseNew` | 7 | Browse new only |
| `kAccessLevelReportNoDD` | 8 | Report without drill-down |
| `kAccessLevelDisableBrowse` | 9 | Browse disabled |

**On import:** Defaults `AccLevel` to `kAccessLevelFull` if 0.

**Access checking:** `CheckConfAccess` verifies that a user's mailbox has appropriate access to a conference, walking up the conference hierarchy (mother conferences).

### 3.3 Conference Signature (`ConfSignVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Matches the mailbox `ConfVc.SerNr` |
| `HtmlFlag` | Integer | Whether signature is HTML |

Stores email signature text (line-based text or HTML). Has record-linked file attachments for HTML signatures. One per mailbox.

### 3.4 Conference Auto-Reply (`ConfAutoReplyVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Matches mailbox SerNr |
| `Activated` | Integer | Whether auto-reply is active |
| `ForwardEnabled` | Integer | Whether forwarding is enabled |
| `ForwardTo` | String | External email address to forward to |
| `Header` | String | Auto-reply subject line |
| `HtmlFlag` | Integer | HTML flag |
| `LTxtCode` | String | Standard text code to paste as body |

**Workflow:**
- On activation: Cleans existing `AutoReplyListVc` entries
- On deactivation (update where `Activated` goes from 1 to 0): Cleans auto-reply list
- Auto-reply body can be composed from `LTxtVc` standard text (pasted on `LTxtCode` change)

### 3.5 Auto-Reply List (`AutoReplyListVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Mailbox SerNr |
| `AddrCode` | String | Sender address |
| `TransDate` | Date | Date of last auto-reply |
| `cnt` | Integer | Count of auto-replies sent today |

Rate-limits auto-replies to max 3 per sender per day. Old entries cleaned daily.

### 3.6 Conference Subscription (`ConfSubVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Sign` | String | User code (current user) |
| `Conference` | LongInt | Conference mailbox number |

**Row fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Conference` | LongInt | Subscribed conference number |

Users subscribe to conferences to receive notifications. Subscribe/unsubscribe toggled via `MailLClassSubscribeFlagButtonAfter`.

### 3.7 Confirmation System (`ConfirmMn`)

**Purpose:** Manages booking/reservation confirmations (for `JobVc` -- hotel/resource reservations).

**Maintenance fields:**
- Date range filter (`sStartDate` to `sEndDate`)
- Sort by `TransDate` or `ConfDate` (flag 2)
- Reservation status filter (`f1`)
- Customer range filter (`f3`)
- Minimum days in advance (`long1`)
- Action: Change status (`f2` = new status) or Delete (flag 1)

**Workflow:** Iterates `JobVc` records, filters by status/date/customer, then either changes reservation status or deletes the record.

### 3.8 Mail Acceptance

**Purpose:** Some mails require recipient acceptance (acknowledgment).

**Fields on `MailVc`:** `RequireAcceptance` flag

**Status tracking** via `MailReadVc.accode`:
- `kMailStatusPostponed` (9) = acceptance postponed
- `kMailStatusAccepted` (10) = accepted
- `kMailStatusRejected` (11) = rejected

**Workflow:**
- On closing a mail window, checks if acceptance is required (`MailAcceptance`)
- If status <= `kMailStatusPostponed`, shows acceptance prompt (message 38544)
- Status checked via `MailAcceptanceStatus` remote function

---

## 4. Asterisk/VOIP Integration

### 4.1 PBX Connection Register (`PBXConnectionVc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `Code` | String | PBX connection code |
| `Closed` | Integer | 0 = active |
| `RemoteUser` | String | SSH user for remote server (default: "asterisk") |
| `RemoteConfigDir` | String | Remote configuration directory |
| `AsteriskControllerKey` | String | Controller key for remote management |

### 4.2 SIP Trunk Register (`SipTrunk2Vc`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `PBXConnection` | String | Parent PBX connection code |
| `Closedf` | Integer | Active/closed flag |
| `ChanSIPf` | Integer | 0 = PJSIP, non-zero = chan_SIP |

**Indexes:** `PBXConnection`

### 4.3 Asterisk Configuration

**Config generation** (`AsteriskSIPConfigMn`):
1. Loads `PBXConnectionVc` record
2. Checks if local or remote Asterisk
3. **Local**: Backs up old config, generates new via `GenerateAsteriskConfigFiles`, reloads
4. **Remote**: Generates config files, uploads via SSH/controller
5. Re-initializes Linphone on all clients (`AllClientsRemoteAsync.ReInitLinphoneOnClient`)

**Asterisk controller states (`kAsteriskController`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kAsteriskControllerOff` | 0 | Not configured |
| `kAsteriskControllerAsteriskInstalled` | 1 | Asterisk installed |
| `kAsteriskControllerAsteriskConfigured` | 2 | Fully configured |

**Restart modes (`kAsteriskRestartMode`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kAsteriskRestartModeConveniently` | 0 | Wait for no ongoing calls |
| `kAsteriskRestartModeGracefully` | 1 | Reject inbound, wait for current calls |
| `kAsteriskRestartModeImmediately` | 2 | Drop ongoing calls |

**Event sounds (`kAsteriskEventSound`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kAsteriskEventSoundWelcome` | 1 | Welcome message |
| `kAsteriskEventSoundLineClosed` | 2 | Line closed message |
| `kAsteriskEventSoundQueueStart` | 3 | Queue start |
| `kAsteriskEventSoundLineBusy` | 4 | Line busy |
| `kAsteriskEventSoundMusicOnHold` | 5 | Music on hold |
| `kAsteriskEventSoundIVRStart` | 6 | IVR start |
| `kAsteriskEventSoundIVRClosed` | 7 | IVR closed |

**Peer types (`kAsteriskPeerType`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kAsteriskTrunkTypeOutbound` | 0 | Outbound only |
| `kAsteriskTrunkTypeBidirectional` | 1 | Bidirectional |

**Register types (`kAsteriskRegisterType`):**
| Constant | Value | Description |
|----------|-------|-------------|
| `kAsteriskRegisterTypeNone` | 0 | No registration |
| `kAsteriskRegisterTypeRegisterContext` | 1 | Register context |
| `kAsteriskRegisterTypeSipRegisterLine` | 2 | SIP register line |

### 4.4 Local Asterisk Settings (`LocalAsteriskBlock`)

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `LocalAsteriskDir` | String | Base directory for local Asterisk installation |

### 4.5 Bank Holiday Integration

Uses `BHollVc` (Bank Holidays) register via `IsBankHoliday` for IVR/queue scheduling.

---

## 5. Settings

### 5.1 Mail Settings Block (`MailSettingsBlock`)

| Field | Type | Description |
|-------|------|-------------|
| `Postmaster` | String | Postmaster conference name (for unsendable internet mail) |
| `FromSystem` | String | System sender address (fallback when user has no mailbox) |
| `ExclEmail` | Integer | Exclude email addresses from reports |
| `MBoxMaxMail` | LongInt | Default max messages in mailbox |
| `MBoxMaxReadDays` | LongInt | Default max age for read mail in mailbox |
| `MBoxMaxUnreadDays` | LongInt | Default max age for unread mail in mailbox |
| `ConMaxMail` | LongInt | Default max messages in conference |
| `ConMaxDays` | LongInt | Default max age for conference messages |
| `NewMaxMail` | LongInt | Default max messages in news |
| `NewMaxDays` | LongInt | Default max days for news |
| `BilMaxMail` | LongInt | Default max messages in billboard |
| `ArcMaxMail` | LongInt | Default max messages in library |
| `ArcMaxDays` | LongInt | Default max days for library |

### 5.2 Anna2 Settings Block (`Anna2SettingsBlock`)

| Field | Type | Description |
|-------|------|-------------|
| `AnnaDebugLog` | Integer | Enable general debug logging |
| `CtxDebug` | Integer | Context debug output mode (`kDebugNone`/`kDebugInline`/`kDebugWindow`) |
| `LLMDebug` | Integer | LLM debug output mode |
| `IntentDebug` | Integer | Intent scoring debug output mode |
| `PerfDebug` | Integer | Performance timing debug output mode |

### 5.3 Module Block (`ModuleBlock`)

Relevant fields for Conference/Mail licensing:
| Field | Type | Description |
|-------|------|-------------|
| `NumberOfUsers` | LongInt | Licensed Level 3 users (-1 = not enabled) |
| `Level1` | LongInt | Licensed Level 1 users |
| `Level2` | LongInt | Licensed Level 2 users |
| `Mailboxes` | LongInt | Licensed concurrent users |
| `ThinClients` | LongInt | Licensed single-function users |
| `NamedBPUsers` | LongInt | Licensed BusinessPhone users |
| `Conferences` | LongInt | Licensed conference count |
| `AllConcurrent` | Integer | All users concurrent mode flag |

### 5.4 Internal Server Type Block (`IntServerTypeBlock`)

| Field | Type | Description |
|-------|------|-------------|
| `Server` | Integer | Server type (`kInternalServerForum` = Forum mode, bypasses mailbox validation) |

---

## 6. Reports

| Report | File | Description |
|--------|------|-------------|
| `SearchMailRn` | `SearchMailRn.hal` | Search mail in user's mailbox -- filters by date range, sender/recipient, text content, tags, attachment name/size, read/unread status |
| `SearchMailConfRn` | `SearchMailRn.hal` | Search mail across conference hierarchy with access control |
| `ChatLogRn` | `ChatLogRn.hal` | Chat log listing by serial number with person and text per row |
| `ChatHistoryRn` | `ChatHistoryRn.hal` | Chat history (C-report delegate) |
| `GlobalChatHistoryRn` | `ChatHistoryRn.hal` | Global chat history across all users |
| `SkypeCallHistoryRn` | `ChatHistoryRn.hal` | Skype/VOIP call history |
| `SkypeMessageCountRn` | `ChatHistoryRn.hal` | Skype message count statistics |
| `ConfAccessRn` | `ConfAccessRn.hal` | Conference access report -- shows which mailboxes can access which conferences, walks hierarchy |
| `ConfirmRn` | Not in HAL (C-report) | Confirmation status report |
| `FindConfRn` | Not in HAL (C-report) | Find conference report |
| `CustConfInfoRn` | Not in HAL (C-report) | Customer confirmation info |
| `UserConfAccessRn` | Not in HAL (C-report) | User conference access |
| `MailCountRn` | Not in HAL (C-report) | Mail count statistics |
| `MailIdentRn` | Not in HAL (C-report) | Mail identification report |
| `MailReadRn` | Not in HAL (C-report) | Mail read status report |
| `MailAcptncStatRn` | Not in HAL (C-report) | Mail acceptance status |
| `EMailAliasRn` | Not in HAL (C-report) | Email alias listing |
| `EMailQueJRn` | Not in HAL (C-report) | Email queue journal |
| `EmailQueListRn` | Not in HAL (C-report) | Email queue listing |

**Search mail filters:**
- Date range (mail date + creation date)
- Sender/recipient/any participant (mode 0/1/2)
- Text search in body and/or subject
- Attachment name search
- Attachment size filter
- Tag filter (set intersection)
- Read/unread/all filter
- With/without/only attachments filter

---

## 7. Maintenances

| Maintenance | File | Description |
|-------------|------|-------------|
| `CleanMailMn` | `CleanMail2Mn.hal` | Clean mailboxes -- removes messages exceeding max count, max read days, or max unread days per conference/mailbox type. Respects `Lifespan` (1=keep, 2=delete). Uses unsafe DB mode. |
| `MailboxCleanMn` | `MailboxCleanMn.hal` | Empty mailbox -- marks all messages as deleted for specified mailbox(es). Supports wildcard `*` for all. |
| `MoveEmailMn` | `MoveEmailMn.hal` | Move emails between conferences/mailboxes -- changes `AddrCode` and `Mailbox` on mail rows from source to destination within date range. |
| `DelSentMailMn` | `DelSentMail.hal` | Delete sent emails from queue -- removes `EMailQueVc` records with `EMailSent = kEMailQueueSent` within date range. |
| `CleanOrpanedEmailsMn` | `CleanOrphanedEMailsMn.hal` | Clean orphaned emails -- runs `TestAndDeleteMail` on all MailVc records; removes MailReadVc with no matching mail. Uses unsafe DB mode. |
| `ClearAttachMn` | `MailboxCleanMn.hal` | Clear attachments -- removes `Attach2Vc` records matching filename pattern, optionally filtered by linked mail date. |
| `MassMailMn` | `MassMailMn.hal` | Mass mail settings -- sets `NoLetterPosting` and `NoMailPosting` flags on customer records within range. |
| `ActToMailMn` | `ActToMailMn.hal` | Activities to Mail -- creates emails from activities with PDF attachments. Groups by customer or project. Uses `MailTextVc` templates. |
| `IVToMailMn` | `IVToMailMn.hal` | Invoices to Mail -- creates emails from invoices. Supports filtering by date, customer, category, classification, invoice type. Can group invoices per customer. Auto-sends if flag set. |
| `ConfirmMn` | `ConfirmMn.hal` | Confirmation maintenance -- changes reservation status or deletes `JobVc` records based on confirmation date/days. |
| `AsteriskSIPConfigMn` | `AsteriskSIPConfigMn.hal` | Generate Asterisk SIP config -- produces config files for local or remote Asterisk, handles SSH transfer, reloads configuration. |

---

## 8. Enums and Constants

### 8.1 Mail Row Types (`kMailRowType`)
```
kMailRowTypeTo = 0      -- To recipient
kMailRowTypeFrom = 1    -- From sender
kMailRowTypeFile = 2    -- File attachment
kMailRowTypeCC = 3      -- CC recipient
kMailRowTypeBCC = 4     -- BCC recipient
```

### 8.2 Mail Status (`kMailStatus`)
```
kMailStatusRead = 0              -- Read
kMailStatusDeleted = 1           -- Deleted
kMailStatusCreated = 2           -- Created
kMailStatusUpdated = 3           -- Updated
kMailStatusUnread = 4            -- Unread
kMailStatusQueued = 5            -- Queued for sending
kMailStatusRouted = 6            -- Routed to internet
kMailStatusPrinted = 7           -- Printed
kMailStatusReadByExternal = 8    -- External read receipt
kMailStatusPostponed = 9         -- Acceptance postponed
kMailStatusAccepted = 10         -- Accepted
kMailStatusRejected = 11         -- Rejected
kMailStatusSMTPError = 12        -- SMTP error
```

### 8.3 Conference Classes (`kConfClass`)
```
kConfClassConference = 0   -- Conference
kConfClassNews = 1         -- News
kConfClassBillboard = 2    -- Billboard
kConfClassLibrary = 3      -- Library
kConfClassFolder = 4       -- Folder
kConfClassMailbox = 5      -- Mailbox
kConfClassArchive = 6      -- Archive
```

### 8.4 Access Levels (`kAccessLevel`)
```
kAccessLevelDummy = 0         -- Not set
kAccessLevelFull = 1          -- Full access
kAccessLevelReadOnly = 2      -- Read only
kAccessLevelReadNew = 3       -- Read new only
kAccessLevelLimited = 4       -- Limited
kAccessLevelNone = 5          -- No access
kAccessLevelBrowse = 6        -- Browse only
kAccessLevelBrowseNew = 7     -- Browse new only
kAccessLevelReportNoDD = 8    -- Report without drill-down
kAccessLevelDisableBrowse = 9 -- Browse disabled
```

### 8.5 Mail Document Types (`kMail`)
```
kMailActivity = 0                    -- Activity
kMailInvoice = 1                     -- Invoice
kMailOpenInvCustStatement = 2        -- Open invoice customer statement
kMailPeriodicCustStatement = 3       -- Periodic customer statement
kMailPurchaseOrder = 4               -- Purchase order
kMailQuotation = 5                   -- Quotation
kMailSalesOrder = 6                  -- Sales order
kMailPeriodicSuppStatement = 7       -- Periodic supplier statement
kMailPOSInvoice = 8                  -- POS invoice
kMailLetter = 9                      -- Letter
kMailPayment = 10                    -- Payment
```

### 8.6 Email Validation States (`kEmailValidationState`)
```
kEmailValidationStateNotValidated = 0
kEmailValidationStatePending = 1
kEmailValidationStateSucceeded = 2
kEmailValidationStateSent = 3
kEmailValidationStateFailed = 4
kEmailValidationStateStdIDNotLoggedIn = 5
```

### 8.7 Debug Output Modes (`kDebugOutput`)
```
kDebugNone = 0    -- No debug output
kDebugInline = 1  -- Inline in chat response
kDebugWindow = 2  -- Separate debug window
```

### 8.8 Chat Node States (`kChatNodeState`)
```
kChatNodeState_Init = 0
kChatNodeState_Processing = 1
```

---

## 9. Cross-Module Integration

### 9.1 Mail <-> Sales/Finance

| Integration | Function | Description |
|-------------|----------|-------------|
| Invoice to Mail | `CreateMailFromIVD` | Creates mail from invoice with PDF attachment |
| Invoice batch to Mail | `CreateMailFromIVArray` | Creates single mail with multiple invoices per customer |
| Order to Mail | `CreateMailFromORD` | Creates mail from sales order |
| Quotation to Mail | `CreateMailFromQTD` | Creates mail from quotation |
| Activity to Mail | `CreateMailFromAct` | Creates mail from activity with PDF attachment and text templates |
| Mail to Activity | `CreateActivityforCustomer_Mail` | Creates CRM activity when mail is sent (links customer) |

### 9.2 Mail <-> CRM

- Sending mail auto-creates activity for customer (`MakeActFromSubSys_MailVc` / `CreateActivityforCustomer_Mail`)
- `ActToMailMn` generates batch emails from activities
- Customer email address resolution: `CUVc.eMail`, contact relations, language codes

### 9.3 Conference <-> Users/Licensing

- Each user gets a mailbox (`ConfVc` with `Class=kConfClassMailbox`)
- User license levels (1/2/3) mapped to conference `UserType`
- Concurrent user counting via `GetNumberOfUsers`
- Single-function users via `OneFunctionVc`

### 9.4 Chat <-> Anna2 AI <-> Business Documents

- Anna2 chatbot can create orders, add items, email documents
- Entity recognition uses `AI_ScoreTaggedCodes` against item register
- Intent matching uses `AI_ScoreIntents` + LLM validation
- Text-to-speech and speech-to-text (Whisper) integration

### 9.5 Asterisk <-> Users

- PBX configuration tied to user mailboxes
- Linphone (SIP client) initialized on all clients after config change
- Bank holiday awareness for IVR scheduling

### 9.6 Attachments

- `Attach2Vc` register for file attachments (linked via `RLinkVc` record links)
- Fields: `FileName`, `FileSize`, `Uploading` (upload-in-progress flag)
- Attachments shared between mails, conferences, auto-replies, HTML templates

### 9.7 Record Links (`RLinkVc`)

- `FromRecidStr`, `ToRecidStr` -- bidirectional links between records
- Used for: mail attachments, mail-to-activity links, mail-to-document links
- `TestAndDeleteMail` checks for incoming record links before deletion

---

## 10. Nexa ERP Implications

### 10.1 Communication Module Design

HansaWorld's communication system is built around these core concepts that Nexa should adopt or adapt:

1. **Unified mailbox model**: A single Conference/Mailbox entity serves as both user inbox and shared discussion space. Nexa should implement a clean separation with:
   - User mailboxes (1:1 with user accounts)
   - Shared channels/conferences (team discussions)
   - The access control model (7 conference classes) can be simplified for MVP

2. **Internal + External mail**: HansaWorld uses the same `MailVc` for both internal messages and external emails, with the `EMailQueVc` as the outbound SMTP queue. Nexa should:
   - Use a unified message store
   - Separate the email gateway (SMTP send/receive) as a service
   - Support HTML and plain text from day one

3. **Document-to-email pipeline**: The `CreateMailFromIVD/ORD/QTD/Act` pattern is crucial for UK SME workflows. Nexa should provide:
   - Template-based email generation from any business document
   - PDF attachment generation
   - Batch email for invoices (per-customer grouping)
   - Mail text templates with language support

### 10.2 AI Chat Integration

The Anna2 system demonstrates a sophisticated AI-assisted ERP chatbot:

1. **Decision tree + LLM hybrid**: Node-based intent routing with LLM-based parameter extraction. Nexa should implement this with modern LLM APIs rather than local llama models.

2. **Business action execution**: The chatbot directly creates orders, adds items, sends emails. Nexa should provide an AI agent API that can:
   - Create/modify business documents
   - Look up customer/product information
   - Send notifications and emails
   - Check delivery dates and stock levels

3. **Context management**: Anna2 stores conversation context (Base64 encoded messages) and parameters. Nexa should use a proper conversation state store.

### 10.3 Features to Include in Nexa MVP

**Must-have:**
- Internal messaging between users
- Email sending from business documents (Invoice, Order, Quotation)
- Email templates with first/last text blocks
- HTML email support with templates
- Email signature per user
- Auto-reply with rate limiting
- Mail search (by date, sender, recipient, text, tags)
- Email queue with status tracking
- Mail acceptance/acknowledgment workflow

**Should-have:**
- Shared conferences/channels for team communication
- Conference access control (per-user, per-group)
- Mail folders within mailboxes
- Conference subscription notifications
- Activity creation from sent mail
- Batch invoice emailing

**Could-have:**
- Live web chat for customer support
- AI chatbot integration (modern LLM-based)
- SMS integration
- VOIP/PBX integration (Asterisk)

### 10.4 Features to Exclude from Nexa

- Skype integration (deprecated)
- HBS Div frameset-based web chat (outdated HTML)
- Local llama model inference (use cloud LLM APIs instead)
- Complex license tier enforcement (Level 1/2/3 user types)
- Fax queue (`FaxQueVc`)

### 10.5 Key Architectural Differences

| HansaWorld | Nexa Recommendation |
|-----------|---------------------|
| `ConfVc` dual-purpose (mailbox + conference) | Separate `Mailbox` and `Channel` entities |
| `MailReadVc` status tracking per mailbox | Use a proper message read-receipt model with timestamps |
| `EMailQueVc` outbound queue | Use a job queue (Bull/BullMQ) with email provider integration |
| `MailFilterVc` simple filters | Implement rule engine for mail filtering |
| Local Asterisk SIP config generation | Cloud PBX API integration (Twilio, Vonage) |
| Anna2 local LLM + decision tree | OpenAI/Anthropic API with function calling |
| HTML stored as record text | Store as proper HTML/Markdown with S3 attachments |
| Signature as `ConfSignVc` text record | User profile settings with rich text signature |
| `RLinkVc` for attachments | Proper attachment table with S3/blob storage |
| `kMailRowType` matrix rows | Separate `MessageRecipient` join table |
