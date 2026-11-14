import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  ETHIOPIAN_MONTHS, GREGORIAN_MONTHS, daysInEthiopianMonth, ethiopianToGregorian, gregorianToEthiopian,
  type CalendarKind, type EthiopianDate, type Lang, type OnboardingProfile,
} from '@db/shared-schemas';
import { t } from '../i18n';
import { cx, ui } from '../wizard/ui';

export type DateOfBirth = NonNullable<OnboardingProfile['dateOfBirth']>;

export interface EthiopianDateSelectProps {
  /** id of the first (Day) select; error-summary links target it. */
  id: string;
  lang: Lang;
  value: DateOfBirth | undefined;
  onChange: (value: DateOfBirth | undefined) => void;
  error?: string;
}

interface Parts { day: string; month: string; year: string }

const today = new Date();
const CURRENT_GREG_YEAR = today.getFullYear();
const CURRENT_ETH_YEAR = gregorianToEthiopian(CURRENT_GREG_YEAR, today.getMonth() + 1, today.getDate()).year;
const YEARS_BACK = 100;

function partsFromValue(value: DateOfBirth | undefined, calendar: CalendarKind): Parts {
  if (!value) return { day: '', month: '', year: '' };
  if (calendar === 'ethiopian') {
    const [y, m, d] = value.iso.split('-').map(Number);
    const eth = value.ethiopian ?? gregorianToEthiopian(y, m, d);
    return { day: String(eth.day), month: String(eth.month), year: String(eth.year) };
  }
  const [y, m, d] = value.iso.split('-').map(Number);
  return { day: String(d), month: String(m), year: String(y) };
}

function daysIn(calendar: CalendarKind, year: number | null, month: number | null): number {
  if (!month) return calendar === 'ethiopian' ? 30 : 31;
  if (calendar === 'ethiopian') return month === 13 && !year ? 6 : daysInEthiopianMonth(year ?? 0, month);
  return new Date(year ?? 2000, month, 0).getDate(); // year 2000 is a leap year: allows 29 Feb until a year is chosen
}

function toValue(parts: Parts, calendar: CalendarKind): DateOfBirth | undefined {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  if (!day || !month || !year || day > daysIn(calendar, year, month)) return undefined;
  if (calendar === 'ethiopian') {
    const ethiopian: EthiopianDate = { year, month, day };
    return { iso: ethiopianToGregorian(ethiopian).iso, displayCalendar: 'ethiopian', ethiopian };
  }
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso, displayCalendar: 'gregorian', ethiopian: gregorianToEthiopian(year, month, day) };
}

export function formatDob(value: DateOfBirth, lang: Lang, calendar: CalendarKind = value.displayCalendar): string {
  const [y, m, d] = value.iso.split('-').map(Number);
  if (calendar === 'ethiopian') {
    const eth = value.ethiopian ?? gregorianToEthiopian(y, m, d);
    return `${ETHIOPIAN_MONTHS[eth.month - 1][lang]} ${eth.day}, ${eth.year}`;
  }
  return `${GREGORIAN_MONTHS[m - 1][lang]} ${d}, ${y}`;
}

/** Calendar choice + three native selects (Day / Month / Year). No drag interactions (WCAG 2.5.7). */
export const EthiopianDateSelect: React.FC<EthiopianDateSelectProps> = ({ id, lang, value, onChange, error }) => {
  const [calendar, setCalendar] = useState<CalendarKind>(value?.displayCalendar ?? 'ethiopian');
  const [parts, setParts] = useState<Parts>(() => partsFromValue(value, value?.displayCalendar ?? 'ethiopian'));

  // Keep in sync if the profile is replaced (e.g. restored from an SMS resume code).
  useEffect(() => {
    if (value && value !== toValue(parts, calendar)) {
      const nextCalendar = value.displayCalendar;
      const next = partsFromValue(value, nextCalendar);
      if (next.day !== parts.day || next.month !== parts.month || next.year !== parts.year || nextCalendar !== calendar) {
        setCalendar(nextCalendar);
        setParts(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.iso, value?.displayCalendar]);

  const update = (next: Parts, cal: CalendarKind = calendar) => {
    const max = daysIn(cal, Number(next.year) || null, Number(next.month) || null);
    const clamped = Number(next.day) > max ? { ...next, day: '' } : next;
    setParts(clamped);
    onChange(toValue(clamped, cal));
  };

  const switchCalendar = (cal: CalendarKind) => {
    if (cal === calendar) return;
    const current = toValue(parts, calendar);
    setCalendar(cal);
    if (current) {
      const converted = partsFromValue(current, cal);
      setParts(converted);
      onChange(toValue(converted, cal));
    } else {
      update({ day: '', month: '', year: '' }, cal);
    }
  };

  const isEth = calendar === 'ethiopian';
  const months = isEth ? ETHIOPIAN_MONTHS : GREGORIAN_MONTHS;
  const maxYear = isEth ? CURRENT_ETH_YEAR : CURRENT_GREG_YEAR;
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => maxYear - i);
  const dayCount = daysIn(calendar, Number(parts.year) || null, Number(parts.month) || null);
  const errorId = error ? `${id}-error` : undefined;
  const complete = toValue(parts, calendar);
  const selectClass = cx(ui.input, error && ui.inputInvalid);

  return (
    <div>
      <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>{t(lang, 'dob.calendarLegend')}</legend>
        {(['ethiopian', 'gregorian'] as const).map((cal) => (
          <div key={cal} className={ui.checkRow}>
            <input
              id={`${id}-cal-${cal}`}
              type="radio"
              name={`${id}-calendar`}
              value={cal}
              checked={calendar === cal}
              onChange={() => switchCalendar(cal)}
              className={ui.checkbox}
            />
            <label htmlFor={`${id}-cal-${cal}`} className="cursor-pointer">
              {t(lang, cal === 'ethiopian' ? 'dob.ethiopian' : 'dob.gregorian')}
            </label>
          </div>
        ))}
      </fieldset>

      <fieldset className={ui.fieldset} aria-describedby={errorId}>
        <legend className={ui.legend}>
          {t(lang, 'dob.legend')} <span className="font-normal">{t(lang, 'wizard.required')}</span>
        </legend>
        {error && (
          <p id={errorId} className={ui.error}>
            <AlertCircle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[6rem]">
            <label htmlFor={id} className={ui.label}>{t(lang, 'dob.day')}</label>
            <select
              id={id}
              value={parts.day}
              onChange={(e) => update({ ...parts, day: e.target.value })}
              autoComplete={isEth ? 'off' : 'bday-day'}
              aria-invalid={error ? true : undefined}
              className={selectClass}
            >
              <option value="">{t(lang, 'wizard.choose')}</option>
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] min-w-[10rem]">
            <label htmlFor={`${id}-month`} className={ui.label}>{t(lang, 'dob.month')}</label>
            <select
              id={`${id}-month`}
              value={parts.month}
              onChange={(e) => update({ ...parts, month: e.target.value })}
              autoComplete={isEth ? 'off' : 'bday-month'}
              aria-invalid={error ? true : undefined}
              className={selectClass}
            >
              <option value="">{t(lang, 'wizard.choose')}</option>
              {months.map((m) => (
                <option key={m.number} value={m.number}>
                  {m[lang]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[7rem]">
            <label htmlFor={`${id}-year`} className={ui.label}>{t(lang, 'dob.year')}</label>
            <select
              id={`${id}-year`}
              value={parts.year}
              onChange={(e) => update({ ...parts, year: e.target.value })}
              autoComplete={isEth ? 'off' : 'bday-year'}
              aria-invalid={error ? true : undefined}
              className={selectClass}
            >
              <option value="">{t(lang, 'wizard.choose')}</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        {isEth && <p className="mt-2 text-sm text-stone-700">{t(lang, 'dob.pagumeNote')}</p>}
      </fieldset>

      {complete && (
        <p className="mb-4 font-semibold">
          {isEth
            ? t(lang, 'dob.inGregorian', { date: formatDob(complete, lang, 'gregorian') })
            : t(lang, 'dob.inEthiopian', { date: formatDob(complete, lang, 'ethiopian') })}
        </p>
      )}
    </div>
  );
};
