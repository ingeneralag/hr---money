import {
  AlertCircle,
  CheckCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const HolidayConfiguration = () => {
  const [holidays, setHolidays] = useState([]);
  const [weekends, setWeekends] = useState([5, 6]); // الجمعة والسبت
  const [customDays, setCustomDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    type: "fixed",
    duration: 1,
  });
  const [newCustomDay, setNewCustomDay] = useState({
    name: "",
    date: "",
  });

  const weekDays = [
    { value: 0, label: "الأحد" },
    { value: 1, label: "الاثنين" },
    { value: 2, label: "الثلاثاء" },
    { value: 3, label: "الأربعاء" },
    { value: 4, label: "الخميس" },
    { value: 5, label: "الجمعة" },
    { value: 6, label: "السبت" },
  ];

  const holidayTypes = [
    { value: "fixed", label: "إجازة ثابتة" },
    { value: "islamic", label: "إجازة إسلامية" },
    { value: "variable", label: "إجازة متغيرة" },
  ];

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL;

      const response = await fetch(
        `${API_BASE_URL}/daily-attendance/holidays`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHolidays(data.data.holidays || []);
        setWeekends(data.data.weekends || [5, 6]);
        setCustomDays(data.data.customDays || []);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("خطأ في تحميل الإجازات:", error);
      setNotification({
        type: "error",
        message: "فشل في تحميل بيانات الإجازات",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveHolidays = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL;

      const response = await fetch(
        `${API_BASE_URL}/daily-attendance/holidays`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            holidays,
            weekends,
            customDays,
          }),
        }
      );

      if (response.ok) {
        setNotification({
          type: "success",
          message: "تم حفظ إعدادات الإجازات بنجاح",
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }
    } catch (error) {
      console.error("خطأ في حفظ الإجازات:", error);
      setNotification({
        type: "error",
        message: "فشل في حفظ إعدادات الإجازات",
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = () => {
    if (newHoliday.name && newHoliday.date) {
      setHolidays([...holidays, { ...newHoliday, id: Date.now() }]);
      setNewHoliday({ name: "", date: "", type: "fixed", duration: 1 });
    }
  };

  const removeHoliday = (index) => {
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  const addCustomDay = () => {
    if (newCustomDay.name && newCustomDay.date) {
      setCustomDays([...customDays, { ...newCustomDay, id: Date.now() }]);
      setNewCustomDay({ name: "", date: "" });
    }
  };

  const removeCustomDay = (index) => {
    setCustomDays(customDays.filter((_, i) => i !== index));
  };

  const toggleWeekend = (dayValue) => {
    if (weekends.includes(dayValue)) {
      setWeekends(weekends.filter((day) => day !== dayValue));
    } else {
      setWeekends([...weekends, dayValue]);
    }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <Alert
          className={`mb-4 ${
            notification.type === "success"
              ? "border-green-500 bg-green-50"
              : "border-red-500 bg-red-50"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <p
            className={
              notification.type === "success"
                ? "text-green-800"
                : "text-red-800"
            }
          >
            {notification.message}
          </p>
        </Alert>
      )}

      {/* العطلات الأسبوعية */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">العطلات الأسبوعية</CardTitle>
          <CardDescription>اختر أيام العطلة الأسبوعية</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {weekDays.map((day) => (
              <label
                key={day.value}
                className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={weekends.includes(day.value)}
                  onChange={() => toggleWeekend(day.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium">{day.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* الإجازات الرسمية */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الإجازات الرسمية</CardTitle>
          <CardDescription>إدارة الإجازات الرسمية والأعياد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* إضافة إجازة جديدة */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="holidayName">اسم الإجازة</Label>
                <Input
                  id="holidayName"
                  value={newHoliday.name}
                  onChange={(e) =>
                    setNewHoliday({ ...newHoliday, name: e.target.value })
                  }
                  placeholder="مثل: عيد الفطر"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="holidayDate">التاريخ</Label>
                <Input
                  id="holidayDate"
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) =>
                    setNewHoliday({ ...newHoliday, date: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="holidayType">النوع</Label>
                <select
                  id="holidayType"
                  value={newHoliday.type}
                  onChange={(e) =>
                    setNewHoliday({ ...newHoliday, type: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {holidayTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="holidayDuration">المدة (أيام)</Label>
                <Input
                  id="holidayDuration"
                  type="number"
                  min="1"
                  max="10"
                  value={newHoliday.duration}
                  onChange={(e) =>
                    setNewHoliday({
                      ...newHoliday,
                      duration: parseInt(e.target.value) || 1,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addHoliday}
                  disabled={!newHoliday.name || !newHoliday.date}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة
                </Button>
              </div>
            </div>
          </div>

          {/* قائمة الإجازات */}
          <div className="space-y-2">
            {holidays.map((holiday, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <div>
                      <p className="font-medium">{holiday.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(holiday.date).toLocaleDateString("ar-EG")} •
                        {
                          holidayTypes.find((t) => t.value === holiday.type)
                            ?.label
                        }{" "}
                        •{holiday.duration}{" "}
                        {holiday.duration === 1 ? "يوم" : "أيام"}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeHoliday(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* الأيام المخصصة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">أيام مخصصة</CardTitle>
          <CardDescription>إضافة أيام إجازة مخصصة أو استثنائية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* إضافة يوم مخصص */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="customName">السبب/الوصف</Label>
                <Input
                  id="customName"
                  value={newCustomDay.name}
                  onChange={(e) =>
                    setNewCustomDay({ ...newCustomDay, name: e.target.value })
                  }
                  placeholder="مثل: إجازة طارئة"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="customDate">التاريخ</Label>
                <Input
                  id="customDate"
                  type="date"
                  value={newCustomDay.date}
                  onChange={(e) =>
                    setNewCustomDay({ ...newCustomDay, date: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addCustomDay}
                  disabled={!newCustomDay.name || !newCustomDay.date}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة
                </Button>
              </div>
            </div>
          </div>

          {/* قائمة الأيام المخصصة */}
          <div className="space-y-2">
            {customDays.map((day, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{day.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(day.date).toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeCustomDay(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* أزرار الحفظ والتحديث */}
      <div className="flex justify-between items-center">
        <Button onClick={loadHolidays} variant="outline" disabled={loading}>
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          تحديث
        </Button>

        <Button
          onClick={saveHolidays}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
};

export default HolidayConfiguration;
