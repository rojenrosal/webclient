import React from 'react';
import { MegaRenderMixin } from '../../../mixins';
import ModalDialogsUI from '../../../../ui/modalDialogs.jsx';
import Button from '../button.jsx';
import { PerfectScrollbar } from '../../../../ui/perfectScrollbar.jsx';
import Datepicker from './datepicker.jsx';
import Select from './select.jsx';
import Invite from './invite.jsx';
import { getTimeIntervals, getNearestHalfHour, getUserTimezone, addMonths } from './helpers.jsx';
import Recurring from './recurring.jsx';

export class Schedule extends MegaRenderMixin {
    static NAMESPACE = 'schedule-dialog';
    static dialogName = `meetings-${Schedule.NAMESPACE}`;

    wrapperRef = React.createRef();
    scheduledMeetingRef = null;
    localStreamRef = '.local-stream';
    datepickerRefs = [];

    interval = ChatRoom.SCHEDULED_MEETINGS_INTERVAL;
    nearestHalfHour = getNearestHalfHour();

    state = {
        topic: '',
        startDateTime: this.nearestHalfHour,
        endDateTime: this.nearestHalfHour + this.interval,
        timezone: getUserTimezone(),
        recurring: false,
        participants: [],
        link: false,
        sendInvite: false,
        openInvite: true,
        description: '',

        closeDialog: false,
        isEdit: false,
        isDirty: false,
        isLoading: false,
        topicInvalid: false,
        invalidTopicMsg: '',
        descriptionInvalid: false,
    };

    /**
     * syncPublicLink
     * @description Sets the `link` state property based on the current chat's `publicLink` field.
     * @return {void} void
     */

    syncPublicLink() {
        if (this.state.isEdit) {
            const { chatRoom } = this.props;
            chatRoom.getPublicLink(() => this.isMounted() && this.setState({ link: !!chatRoom.publicLink }));
        }
    }

    /**
     * getFilteredTimeIntervals
     * @description Returns filtered time intervals for the passed timestamp, incl. optionally a duration string
     * for each of the generated intervals based on passed additional offset timestamp. Time intervals
     * prior `Date.now()` are filtered out.
     *
     * ex.:
     * const now = offset = Date.now();
     * time2date(now / 1000) -> `10/28/2022, 14:38`
     *
     *  getFilteredTimeIntervals(now, offset)
     * [
     *     {value: 1666958411784, label: '15:00', duration: 1440000},
     *     {value: 1666960211784, label: '15:30', duration: 3240000},
     *     {value: 1666962023055, label: '16:00', duration: 4980000},
     *     {value: 1666963823055, label: '16:30', duration: 6780000}
     *     ...
     * ]
     *
     * @param {number} timestamp Timestamp to generate intervals based on
     * @param {number} [offsetFrom] Timestamp used as offset to generate duration strings
     * @see getTimeIntervals
     * @return [{ value: number, label: string, duration: number }] Filtered time intervals
     */

    getFilteredTimeIntervals(timestamp, offsetFrom) {
        const timeIntervals = getTimeIntervals(timestamp, offsetFrom);

        // Editing a past scheduled meeting -> include all available time intervals, e.g. including past ones
        const { end } = this.scheduledMeetingRef || {};
        if (this.state.isEdit && end < Date.now()) {
            return timeIntervals;
        }

        // New scheduled meeting -> only show time intervals forward from now
        return timeIntervals.filter(o => {
            return offsetFrom ? o.value > this.nearestHalfHour : o.value > Date.now();
        });
    }

    // --

    /**
     * handleToggle
     * @description Updates conditionally the state based on the passed `prop`. See checkbox and toggle components,
     * e.g. `recurring`, `link`, `sendInvite`, etc.
     * @param {string} prop State property to update
     * @return {false|void}
     */

    handleToggle = prop => {
        return Object.keys(this.state).includes(prop) &&
            this.setState(state => ({ [prop]: !state[prop], isDirty: true }));
    };

    /**
     * handleChange
     * @description Updates the state based on the passed `props` and `value`. See text inputs and textarea components,
     * e.g. `topic`, `description`.
     * @param {string} prop State property to update
     * @param {string|number} value The value being assigned to the given state prop
     * @return {false|void}
     */

    handleChange = (prop, value) => {
        return Object.keys(this.state).includes(prop) && this.setState({ [prop]: value, isDirty: true });
    };

    /**
     * handleDateSelect
     * @description Handles the date selection on the `Datepicker` components; sets the
     * `startDateTime` and `endDateTime` conditionally, marks the form as updated. Optionally invokes passed callback
     * function, e.g. to sync the `Datepicker` instances.
     * @param {number} [startDateTime] Timestamp in milliseconds for the `startDateTime` state prop
     * @param {number} [endDateTime] Timestamp in milliseconds for the `endDateTime` state prop
     * @param {function} [callback] Optional `setState` callback; used to sync the `Datepicker` components, e.g.
     * when `startDateTime` > `endDateTime` or `endDateTime` < `startDateTime`.
     * @see Datepicker
     * @return {void}
     */

    handleDateSelect = ({ startDateTime, endDateTime }, callback) => {
        this.setState(
            state => ({
                startDateTime: startDateTime || state.startDateTime,
                endDateTime: endDateTime || state.endDateTime,
                isDirty: true
            }),
            () => {
                if (callback) {
                    callback();
                }
                // Sync the recurring `End` field based on the selected start date for the main meeting
                const { recurring } = this.state;
                if (recurring && recurring.end) {
                    const recurringEnd = addMonths(this.state.startDateTime, 6);
                    this.datepickerRefs.recurringEnd.selectDate(new Date(recurringEnd));
                }
            }
        );
    };

    /**
     * handleTimeSelect
     * @description Handles the time selection on the `Select` components; sets the `startDateTime` and `endDateTime`
     * and marks the form as updated. Conditionally increments or decrements 30 minutes when the selected
     * `startDateTime` > `endDateTime` or `endDateTime` < `startDateTime`.
     * @param {number} [startDateTime] Timestamp in milliseconds for the `startDateTime` state prop
     * @param {number} [endDateTime] Timestamp in milliseconds for the `endDateTime` state prop
     * @see Select
     * @return {void}
     */

    handleTimeSelect = ({ startDateTime, endDateTime }) => {
        startDateTime = startDateTime || this.state.startDateTime;
        endDateTime = endDateTime || this.state.endDateTime;
        this.setState(state => {
            return {
                startDateTime: endDateTime <= state.startDateTime ? endDateTime - this.interval : startDateTime,
                endDateTime: startDateTime >= state.endDateTime ? startDateTime + this.interval : endDateTime,
                isDirty: true
            };
        });
    };

    /**
     * handleParticipantSelect
     * @description Updates the state based on added and/or removed set of participant user handles.
     * @param {String[]} participants User handles of the selected participants
     * @see Invite
     * @return {void}
     */

    handleParticipantSelect = participants => {
        return (
            participants &&
            Array.isArray(participants) &&
            this.setState({ participants, isDirty: true }, () => {
                const wrapperRef = this.wrapperRef && this.wrapperRef.current;
                if (wrapperRef) {
                    wrapperRef.reinitialise();
                }
            })
        );
    };

    // --

    /**
     * handleSubmit
     * @description Creates a new scheduled meeting based on the selected options. Alternatively,
     * assuming `chatRoom` is present -- updates the current one.
     * @return {void}
     */

    handleSubmit = () => {
        this.setState({ isLoading: true }, async() => {
            const { chatRoom, onClose } = this.props;
            await megaChat.plugins.meetingsManager[chatRoom ? 'updateMeeting' : 'createMeeting'](this.state, chatRoom);
            this.setState({ isLoading: false }, () => onClose());
        });
    };

    componentWillUnmount() {
        super.componentWillUnmount();
        if ($.dialog === Schedule.dialogName) {
            closeDialog();
        }
        [document, this.localStreamRef].map(el => $(el).unbind(`.${Schedule.NAMESPACE}`));
    }

    componentWillMount() {
        const { chatRoom } = this.props;
        if (chatRoom) {
            const { scheduledMeeting, publicLink, options } = chatRoom;

            this.state.topic = scheduledMeeting.title;
            this.state.startDateTime = scheduledMeeting.start;
            this.state.endDateTime = scheduledMeeting.end;
            this.state.timezone = scheduledMeeting.timezone || getUserTimezone();
            this.state.recurring = scheduledMeeting.recurring;
            this.state.participants = chatRoom.getParticipantsExceptMe();
            this.state.link = !!publicLink;
            this.state.description = scheduledMeeting.description || '';
            this.state.sendInvite = scheduledMeeting.flags;
            this.state.openInvite = options.oi;
            this.state.isEdit = true;

            this.scheduledMeetingRef = scheduledMeeting;
        }
    }

    componentDidMount() {
        super.componentDidMount();
        this.syncPublicLink();
        if ($.dialog === 'onboardingDialog') {
            closeDialog();
        }
        M.safeShowDialog(Schedule.dialogName, () => {
            if (!this.isMounted()) {
                throw new Error(`${Schedule.dialogName} dialog: component ${Schedule.NAMESPACE} not mounted.`);
            }

            // Invoke submit on hitting enter, excl. while typing in the `description` text area or
            // if the confirmation dialog is currently shown
            $(document).rebind(`keyup.${Schedule.NAMESPACE}`, ({ keyCode, target }) => {
                return this.state.closeDialog || target instanceof HTMLTextAreaElement ?
                    null :
                    keyCode === 13 /* Enter */ && this.handleSubmit();
            });

            // Clicked on the `Local` component (the call's mini view) while the `Schedule meeting`
            // dialog is opened -> ask for close confirmation if any changes have been done or close the dialog
            // immediately
            $(this.localStreamRef).rebind(`click.${Schedule.NAMESPACE}`, () => {
                if (this.state.isDirty) {
                    this.handleToggle('closeDialog');
                    return false;
                }
            });

            return $(`#${Schedule.NAMESPACE}`);
        });
    }

    render() {
        const { NAMESPACE, dialogName } = Schedule;
        const {
            topic, startDateTime, endDateTime, recurring, participants, link, sendInvite, openInvite, description,
            closeDialog, isEdit, isDirty, isLoading, topicInvalid, invalidTopicMsg, descriptionInvalid
        } = this.state;

        return (
            <ModalDialogsUI.ModalDialog
                {...this.state}
                id={NAMESPACE}
                className={closeDialog ? 'with-confirmation-dialog' : ''}
                dialogName={dialogName}
                dialogType="main"
                onClose={() => {
                    return isDirty ? this.handleToggle('closeDialog') : this.props.onClose();
                }}>
                <Header
                    chatRoom={isEdit && this.props.chatRoom}
                />

                <PerfectScrollbar
                    ref={this.wrapperRef}
                    className="fm-dialog-body"
                    options={{ suppressScrollX: true }}>
                    <Input
                        name="topic"
                        placeholder={l.schedule_title_input /* `Meeting name` */}
                        value={topic}
                        invalid={topicInvalid}
                        invalidMessage={invalidTopicMsg}
                        autoFocus={true}
                        isLoading={isLoading}
                        onFocus={() => topicInvalid && this.setState({ topicInvalid: false })}
                        onChange={val => {
                            if (val.length > ChatRoom.TOPIC_MAX_LENGTH) {
                                /* `Enter fewer than 30 characters` */
                                this.setState({ invalidTopicMsg: l.err_schedule_title_long, topicInvalid: true });
                                val = val.substring(0, ChatRoom.TOPIC_MAX_LENGTH);
                            }
                            else if (val.length === 0) {
                                /* `Meeting name is required` */
                                this.setState({ invalidTopicMsg: l.schedule_title_missing, topicInvalid: true });
                            }
                            else if (this.state.invalidTopicMsg) {
                                this.setState({ invalidTopicMsg: '', topicInvalid: false });
                            }
                            this.handleChange('topic', val);
                        }}
                    />

                    {/* --- */}

                    <Row className="start-aligned">
                        <Column>
                            <i className="sprite-fm-mono icon-recents-filled" />
                        </Column>
                        <div className="schedule-date-container">
                            <DateTime
                                name="startDateTime"
                                altField="startTime"
                                startDate={startDateTime}
                                value={startDateTime}
                                filteredTimeIntervals={this.getFilteredTimeIntervals(startDateTime)}
                                label={l.schedule_start_date /* `Start date` */}
                                isLoading={isLoading}
                                onMount={datepicker => {
                                    this.datepickerRefs.startDateTime = datepicker;
                                }}
                                onSelectDate={startDateTime => {
                                    this.handleDateSelect({ startDateTime }, () => {
                                        const { startDateTime, endDateTime } = this.state;
                                        if (startDateTime > endDateTime) {
                                            this.datepickerRefs.endDateTime.selectDate(
                                                new Date(startDateTime + this.interval)
                                            );
                                        }
                                    });
                                }}
                                onSelectTime={({ value: startDateTime }) => {
                                    this.handleTimeSelect({ startDateTime });
                                }}
                            />

                            <DateTime
                                name="endDateTime"
                                altField="endTime"
                                isLoading={isLoading}
                                startDate={endDateTime}
                                value={endDateTime}
                                filteredTimeIntervals={this.getFilteredTimeIntervals(endDateTime, startDateTime)}
                                label={l.schedule_end_date /* `End date` */}
                                onMount={datepicker => {
                                    this.datepickerRefs.endDateTime = datepicker;
                                }}
                                onSelectDate={endDateTime => {
                                    this.handleDateSelect({ endDateTime }, () => {
                                        const { startDateTime, endDateTime } = this.state;
                                        if (endDateTime < startDateTime) {
                                            if (endDateTime < Date.now()) {
                                                return this.setState({ endDateTime: startDateTime + this.interval });
                                            }
                                            this.datepickerRefs.startDateTime.selectDate(
                                                new Date(endDateTime - this.interval)
                                            );
                                        }
                                    });
                                }}
                                onSelectTime={({ value: endDateTime }) => {
                                    this.handleTimeSelect({ endDateTime });
                                }}
                            />
                        </div>
                    </Row>

                    {/* --- */}

                    <Checkbox
                        name="recurring"
                        checked={recurring}
                        label={l.schedule_recurring_label /* `Recurring meeting` */}
                        isLoading={isLoading}
                        onToggle={this.handleToggle}
                    />

                    {recurring &&
                        <Recurring
                            chatRoom={this.props.chatRoom}
                            startDateTime={startDateTime}
                            endDateTime={endDateTime}
                            onMount={datepicker => {
                                this.datepickerRefs.recurringEnd = datepicker;
                            }}
                            onUpdate={state => {
                                this.setState({ recurring: state });
                            }}
                        />
                    }

                    {/* --- */}

                    <Row>
                        <Column>
                            <i className="sprite-fm-mono icon-contacts"/>
                        </Column>
                        <Column>
                            <Invite
                                className={isLoading ? 'disabled' : ''}
                                participants={participants}
                                onSelect={this.handleParticipantSelect}
                            />
                        </Column>
                    </Row>

                    {/* --- */}

                    <Switch
                        name="link"
                        toggled={link}
                        label={l.schedule_link_label /* `Meeting link` */}
                        isLoading={isLoading}
                        onToggle={this.handleToggle}
                    />

                    {/* --- */}

                    <Checkbox
                        name="sendInvite"
                        checked={sendInvite}
                        label={l.schedule_invite_label /* `Send calendar invite` */}
                        isLoading={isLoading}
                        onToggle={this.handleToggle}
                    />

                    {/* --- */}

                    <Checkbox
                        name="openInvite"
                        checked={openInvite}
                        label={l.open_invite_desc /* `Allow non-hosts to add participants` */}
                        isLoading={isLoading}
                        onToggle={this.handleToggle}
                    />

                    {/* --- */}

                    <Textarea
                        name="description"
                        invalid={descriptionInvalid}
                        placeholder={l.schedule_description_input /* `Add a description` */}
                        value={description}
                        onFocus={() => descriptionInvalid && this.setState({ descriptionInvalid: false })}
                        onChange={val => {
                            if (val.length > 3000) {
                                this.setState({ descriptionInvalid: true });
                                val = val.substring(0, 3000);
                            }
                            else if (this.state.descriptionInvalid) {
                                this.setState({ descriptionInvalid: false });
                            }
                            this.handleChange('description', val);
                        }}
                    />
                </PerfectScrollbar>

                <Footer
                    isLoading={isLoading}
                    isEdit={isEdit}
                    topic={topic}
                    onSubmit={this.handleSubmit}
                    onInvalid={() => this.setState({
                        topicInvalid: !topic,
                        invalidTopicMsg: l.schedule_title_missing /* `Meeting name is required` */
                    })}
                />

                {closeDialog &&
                    <CloseDialog
                        onToggle={this.handleToggle}
                        onClose={this.props.onClose}
                    />
                }
            </ModalDialogsUI.ModalDialog>
        );
    }
}

// --

export const CloseDialog = ({ onToggle, onClose }) => {
    return (
        <>
            <ModalDialogsUI.ModalDialog
                name={`${Schedule.NAMESPACE}-confirmation`}
                dialogType="message"
                className={`
                    with-close-btn
                    ${Schedule.NAMESPACE}-confirmation
                `}
                title={l.schedule_discard_dlg_title /* `Discard meeting or keep editing?` */}
                icon="sprite-fm-uni icon-question"
                buttons={[
                    { key: 'n', label: l.schedule_discard_cancel, onClick: () => onToggle('closeDialog') },
                    { key: 'y', label: l.schedule_discard_confirm, className: 'positive', onClick: onClose }
                ]}
                noCloseOnClickOutside={true}
                stopKeyPropagation={true}
                hideOverlay={true}
                onClose={() => onToggle('closeDialog')}
            />
            <div
                className={`${Schedule.NAMESPACE}-confirmation-overlay`}
                onClick={() => onToggle('closeDialog')}
            />
        </>
    );
};

export const Row = ({ children, className }) =>
    <div
        className={`
            ${Schedule.NAMESPACE}-row
            ${className || ''}
        `}>
        {children}
    </div>;

export const Column = ({ children, className }) =>
    <div
        className={`
            ${Schedule.NAMESPACE}-column
            ${className || ''}
        `}>
        {children}
    </div>;

/**
 * Header
 * @param chatRoom
 * @return {React.Element}
 */

const Header = ({ chatRoom }) => {
    const $$container = title =>
        <header>
            <h2>{title}</h2>
        </header>;

    if (chatRoom) {
        const { scheduledMeeting } = chatRoom;
        return $$container(scheduledMeeting.isRecurring ? l.edit_meeting_series_title : l.edit_meeting_title);
    }

    return $$container(l.schedule_meeting_title);
};

/**
 * Input
 * @param name
 * @param placeholder
 * @param value
 * @param invalid
 * @param invalidMessage
 * @param autoFocus
 * @param isLoading
 * @param onFocus
 * @param onChange
 * @return {React.Element}
 */

const Input = ({ name, placeholder, value, invalid, invalidMessage, autoFocus, isLoading, onFocus, onChange }) => {
    return (
        <Row className={invalid ? 'invalid-aligned' : ''}>
            <Column>
                <i className="sprite-fm-mono icon-rename"/>
            </Column>
            <Column>
                <div
                    className={`
                        mega-input
                        ${invalid ? 'error msg' : ''}
                    `}>
                    <input
                        type="text"
                        name={`${Schedule.NAMESPACE}-${name}`}
                        className={isLoading ? 'disabled' : ''}
                        autoFocus={autoFocus}
                        autoComplete="off"
                        placeholder={placeholder}
                        value={value}
                        onFocus={onFocus}
                        onChange={({ target }) => onChange(target.value)}
                    />
                    {invalid &&
                        <div className="message-container mega-banner">
                            {invalidMessage}
                        </div>
                    }
                </div>
            </Column>
        </Row>
    );
};

/**
 * DateTime
 * @param name
 * @param isLoading
 * @param startDate
 * @param altField
 * @param value
 * @param minDate
 * @param filteredTimeIntervals
 * @param label
 * @param onMount
 * @param onSelectDate
 * @param onSelectTime
 * @return {React.Element}
 */

export const DateTime = ({
    name,
    startDate,
    altField,
    value,
    minDate,
    filteredTimeIntervals,
    label,
    isLoading,
    onMount,
    onSelectDate,
    onSelectTime
}) => {
    return (
        <>
            {label && <span>{label}</span>}
            <Datepicker
                name={`${Datepicker.NAMESPACE}-${name}`}
                className={isLoading ? 'disabled' : ''}
                startDate={startDate}
                altField={`${Select.NAMESPACE}-${altField}`}
                value={value}
                minDate={minDate}
                onMount={onMount}
                onSelect={onSelectDate}
            />
            <Select
                name={`${Select.NAMESPACE}-${altField}`}
                className={isLoading ? 'disabled' : ''}
                options={filteredTimeIntervals}
                value={value}
                format={toLocaleTime}
                onSelect={onSelectTime}
            />
        </>
    );
};

/**
 * Checkbox
 * @param name
 * @param checked
 * @param label
 * @param onToggle
 * @param isLoading
 * @return {React.Element}
 */

const Checkbox = ({ name, checked, label, isLoading, onToggle }) => {
    return (
        <Row>
            <Column>
                <div
                    className={`
                        checkdiv
                        ${checked ? 'checkboxOn' : 'checkboxOff'}
                    `}>
                    <input
                        name={`${Schedule.NAMESPACE}-${name}`}
                        className={isLoading ? 'disabled' : ''}
                        type="checkbox"
                        onChange={() => onToggle(name)}
                    />
                </div>
            </Column>
            <Column>
                <label
                    htmlFor={`${Schedule.NAMESPACE}-${name}`}
                    className={isLoading ? 'disabled' : ''}
                    onClick={() => onToggle(name)}>
                    {label}
                </label>
            </Column>
        </Row>
    );
};

/**
 * Switch
 * @param name
 * @param toggled
 * @param label
 * @param isLoading
 * @param onToggle
 * @return {React.Element}
 */

const Switch = ({ name, toggled, label, isLoading, onToggle }) => {
    return (
        <Row>
            <Column>
                <i className="sprite-fm-uni icon-mega-logo"/>
            </Column>
            <Column>
                <span
                    className={`
                        schedule-label
                        ${isLoading ? 'disabled' : ''}
                    `}
                    onClick={() => onToggle(name)}>
                    {label}
                </span>
                <div
                    className={`
                        mega-switch
                        ${toggled ? 'toggle-on' : ''}
                        ${isLoading ? 'disabled' : ''}
                    `}
                    onClick={() => onToggle(name)}>
                    <div
                        className={`
                            mega-feature-switch
                            sprite-fm-mono-after
                            ${toggled ? 'icon-check-after' : 'icon-minimise-after'}
                        `}
                    />
                </div>
            </Column>
        </Row>
    );
};

/**
 * Textarea
 * @param name
 * @param placeholder
 * @param isLoading
 * @param value
 * @param onChange
 * @return {React.Element}
 */

const Textarea = ({ name, placeholder, isLoading, value, invalid, onChange, onFocus }) => {
    return (
        <Row className="start-aligned">
            <Column>
                <i className="sprite-fm-mono icon-description"/>
            </Column>
            <Column>
                <div className={`mega-input box-style textarea ${invalid ? 'error' : ''}`}>
                    <textarea
                        name={`${Schedule.NAMESPACE}-${name}`}
                        className={isLoading ? 'disabled' : ''}
                        placeholder={placeholder}
                        value={value}
                        onChange={({ target }) => onChange(target.value)}
                        onFocus={onFocus}
                    />
                </div>
                {invalid &&
                    <div className="mega-input error msg textarea-error">
                        <div className="message-container mega-banner">
                            {l.err_schedule_desc_long /* `Enter fewer than 3000 characters` */}
                        </div>
                    </div>
                }
            </Column>
        </Row>
    );
};

/**
 * Footer
 * @param isLoading
 * @param isEdit
 * @param topic
 * @param onSubmit
 * @param onInvalid
 * @return {React.Element}
 */

const Footer = ({ isLoading, isEdit, topic, onSubmit, onInvalid }) => {
    return (
        <footer>
            <div className="footer-container">
                <Button
                    className={`
                        mega-button
                        positive
                        ${isLoading ? 'disabled' : ''}
                    `}
                    onClick={() => {
                        if (!isLoading) {
                            return topic ? onSubmit() : onInvalid();
                        }
                    }}
                    topic={topic}>
                    <span>{isEdit ? l.update_meeting_button : l.schedule_meeting_button}</span>
                </Button>
            </div>
        </footer>
    );
};
