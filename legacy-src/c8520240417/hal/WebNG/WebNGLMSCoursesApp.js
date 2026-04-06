document.addEventListener("DOMContentLoaded", function () {
  function handleDragStartContentLine(e) {
    dragSrcEl = this;
    e.originalEvent.dataTransfer.effectAllowed = "move";
    e.originalEvent.dataTransfer.setData("text/html", this.innerHTML);
    
    var $dragImg = $(this)
    .clone()
    .css({
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.2)",
    border: "2px solid grey",
    })
    .appendTo("body");
    
    e.originalEvent.dataTransfer.setDragImage($dragImg.get(0), 0, 0);
    
    setTimeout(() => $dragImg.remove(), 0);
  }
  
  function handleDropContentLine(e) {
    e.stopPropagation();
    e.preventDefault();
    
    let $sourceList = $(dragSrcEl).closest(".content-list");
    let $targetList = $(this).closest(".content-list");
    
    if ($sourceList.length && $targetList.length && $sourceList.data("recordid") === $targetList.data("recordid")) {
      if (dragSrcEl !== this) {
        let $placeholder = $("<div>").insertBefore(dragSrcEl);
        $(dragSrcEl).insertBefore(this);
        $(this).insertBefore($placeholder);
        $placeholder.remove();
        
        let sortedIds = $sourceList
        .find(".content-line")
        .filter((_, line) => $(line).data("recordid") !== undefined)
        .map((_, line) => $(line).data("recordid"))
        .get();
        updateCourseContentSortOrder(sortedIds);
      }
    } else {
      console.log("Drop outside the same content-list is not allowed");
    }
  }
  
  function handleDragOverContentLine(e) {
    e.preventDefault();
    e.originalEvent.dataTransfer.dropEffect = "move";
  }
  
  if (isEditModeActive()) {
    addContentLines();
  }
  
  $(".course-content .content-line").on("dragstart", handleDragStartContentLine);
  $(".course-content").on("drop", ".content-line", handleDropContentLine);
  $(".course-content").on("dragover", ".content-line", handleDragOverContentLine);
});

function isEditModeActive() {
  var url = new URL(window.location.href);
  return url.searchParams.has("edit");
}

function LMSCoursesApp() {
  this.checkedCnt = 0;
}

LMSCoursesApp.prototype = {
UpdateCourseData: function (data) {
  var ajaxUrl = "";
  var dataSent = {};
  const { actiontype, visible, course } = data;
  
  switch (actiontype) {
    case "update_visible":
      dataSent = { actiontype, visible, course };
      ajaxUrl = LMSCourses.UpdateCourseVisible;
      break;
    case "create_record":
      dataSent = data;
      ajaxUrl = LMSCourses.CreateCourse;
      break;
    case "update_record":
      dataSent = data;
      ajaxUrl = LMSCourses.UpdateCourse;
      break;
    default:
      return;
  }
  
  $.ajax({
  type: "POST",
  url: ajaxUrl,
  data: dataSent,
  success: function (response) {
    const status = $(response).find("status");
    status.each(function () {
      const code = $(this).attr("code");
      const errmsg = $(this).attr("errmsg");
      if (code === "success") {
        var currentUrl = new URL(window.location.href);
        if (actiontype == "create_record") {
          window.location.href = currentUrl.origin + currentUrl.pathname.split("/new")[0] + "/overview?edit=true";
        } else if (actiontype == "update_record") {
          GoBackWithRefresh();
          // window.location.href = currentUrl.origin + currentUrl.pathname.split("/edit")[0] + "/overview?edit=true";
        }
      } else if (code === "failed") {
        alert(errmsg);
      }
    });
  },
  error: function (thrownError) {
    console.error("Error:", thrownError);
  },
  });
  $("#createButton").prop("disabled", false);
},
UpdateTopicData: function (data) {
  const { actiontype, name, visible, direction, topic, courseId } = data;
  
  switch (actiontype) {
    case "update_visible":
      dataSent = { actiontype, visible, topic };
      ajaxUrl = LMSCourses.UpdateTopicVisible;
      break;
    case "create_record":
      dataSent = data;
      ajaxUrl = LMSCourses.CreateTopic;
      break;
    case "update_sortorder":
      dataSent = { actiontype, direction, topic };
      ajaxUrl = LMSCourses.UpdateTopicSortOrder;
      break;
    case "update_record":
      dataSent = data;
      ajaxUrl = LMSCourses.UpdateTopic;
      break;
    default:
      return;
  }
  
  $.ajax({
  type: "POST",
  url: ajaxUrl,
  data: dataSent,
  success: function (response) {
    const status = $(response).find("status");
    status.each(function () {
      const code = $(this).attr("code");
      const errmsg = $(this).attr("errmsg");
      if (code === "success") {
        var currentUrl = new URL(window.location.href);
        if (actiontype == "create_record") {
          window.location.href = currentUrl.origin + currentUrl.pathname.split("/new")[0] + "/overview?edit=true";
        } else if (actiontype == "update_record") {
          window.location.href = currentUrl.origin + currentUrl.pathname.split("/edit")[0] + "/overview?edit=true";
        } else if (actiontype == "update_sortorder") {
          location.reload();
        }
      } else if (code === "failed") {
        alert(errmsg);
      }
    });
  },
  error: function (thrownError) {
    console.error("Error:", thrownError);
  },
  });
  $("#createButton").prop("disabled", false);
},
UpdateCourseContentData: function (data) {
  var ajaxUrl = "";
  var dataSent = {};
  const { actiontype, sortOrder, coursecontent, visible } = data;
  
  switch (actiontype) {
    case "update_sortorder":
      dataSent = { actiontype, sortOrder, coursecontent };
      ajaxUrl = LMSCourses.UpdateCourseContentSortOrder;
      break;
    case "update_visible":
      dataSent = { actiontype, visible, coursecontent };
      ajaxUrl = LMSCourses.UpdateCourseContentVisible;
      break;
    case "create_record":
      dataSent = data;
      ajaxUrl = LMSCourses.CreateCourseContent;
      break;
    case "update_record":
      dataSent = data;
      ajaxUrl = LMSCourses.UpdateCourseContent;
      break;
    default:
      return;
  }
  
  $.ajax({
  type: "POST",
  url: ajaxUrl,
  data: dataSent,
  success: function (response) {
    var currentUrl = new URL(window.location.href);
    if (actiontype == "create_record") {
      window.location.href = currentUrl.origin + currentUrl.pathname.split("/new")[0] + "/overview?edit=true";
    } else if (actiontype == "update_record") {
      window.location.href = currentUrl.origin + currentUrl.pathname.split("/edit")[0] + "/overview?edit=true";
    }
    $("#createButton").prop("disabled", false);
    removeLoadingElements();
  },
  error: function (thrownError) {
    removeLoadingElements();
  },
  });
},
CreateRecord: function (formData) {
  $.ajax({
  type: "POST",
  url: LMSCourses.UpdateCourse,
  data: { actiontype, name, course },
  success: function (response) {
    // Handle success
  },
  error: function (thrownError) {
    console.error("Error:", thrownError);
  },
  });
},
DeleteRecord: function (data) {
  var url = "";
  const { register, recordId, rownr } = data;
  switch (register) {
    case "CourseContentVc":
      url = LMSCourses.DeleteCourseContent;
      break;
    case "WebNGLMSTopicVc":
      url = LMSCourses.DeleteTopic;
      break;
    case "StudentCourseVc":
      url = LMSCourses.DeleteStudentCourse;
      break;
    case "Course2Vc":
      url = LMSCourses.DeleteCourse;
    default:
      break;
  }
  $.ajax({
  type: "POST",
  url: url,
  data: data,
  success: function (response) {
    const status = $(response).find("status");
    status.each(function () {
      const code = $(this).attr("code");
      const errmsg = $(this).attr("errmsg");
      if (code === "success") {
        switch (register) {
          case "CourseContentVc":
            $('.content-line[data-recordid="' + recordId + '"]').remove();
            break;
          case "WebNGLMSTopicVc":
            $('.content-list[data-recordid="' + recordId + '"]').remove();
            break;
          case "StudentCourseVc":
            $('tr[data-rownr="' + rownr + '"]').remove();
            break;
          case "Course2Vc":
            $('.course-line[data-recordid="' + recordId + '"]').remove();
            break;
          default:
            break;
        }
      } else if (code === "failed") {
        alert(errmsg);
      }
    });
  },
  error: function (thrownError) {
    console.error("Error:", thrownError);
  },
  });
},
EnrolStudent: function (data) {
  const { action, regkey, course, selfEnrol, student, availableFromDate, availableFromTime, availableToDate, availableToTime } = data;
  var ajaxUrl = "";
  switch (action) {
    case "create":
      ajaxUrl = LMSCourses.CreateStudentCourse;
      break;
    case "update":
      ajaxUrl = LMSCourses.UpdateStudentCourse;
      break;
    default:
      return;
  }
  $.ajax({
  type: "POST",
  url: ajaxUrl,
  data: data,
  success: function (response) {
    const status = $(response).find("status");
    status.each(function () {
      const code = $(this).attr("code");
      const errmsg = $(this).attr("errmsg");
      if (code === "success") {
        if (data.selfEnrol) {
          var currentUrl = new URL(window.location.href);
          window.location.href = currentUrl.origin + currentUrl.pathname.split("/course")[0] + "/course/" + course + "/overview";
        } else {
          location.reload();
        }
      } else if (code === "failed") {
        alert(errmsg);
      }
    });
  },
  error: function (thrownError) {
    console.error("Error:", thrownError);
  },
  });
  $("#registerButton").prop("disabled", false);
  $("#applyButton").prop("disabled", false);
  $("#addStudentButton").prop("disabled", false);
  $("#updateStudentButton").prop("disabled", false);
},
StudentCourseDeleteAll: function (course) {
  $.ajax({
  type: "POST",
  url: LMSCourses.DeleteAllStudentCourse,
  data: { course },
  success: function (response) {
    const status = $(response).find("status");
    status.each(function () {
      const code = $(this).attr("code");
      const errmsg = $(this).attr("errmsg");
      if (code === "success") {
        location.reload();
      } else if (code === "failed") {
        alert(errmsg);
      }
    });
  },
  error: function (thrownError) {
    console.error("Error:", thrownError);
  },
  });
},
};

function addContentLines() {
  $(".content-list").each(function () {
    var parentid = $(this).data("recordid");
    
    if (!$(this).find(".new-content-line").length) {
      $(this).append(`
                <div class="new-content-line">
                    <select class="new-content-select" data-recordid="${parentid}">
                        <option value="">New Course Content</option>
                        <option value="0">Assignment</option>
                        <option value="1">Attendance</option>
                        <option value="2">File</option>
                        <option value="3">Folder</option>
                        <option value="4">URL</option>
                        <option value="5">Test</option>
                    </select>
                </div>
            `);
    }
  });
  
  $(".new-content-select")
  .off("change")
  .change(function () {
    var selectedOption = $(this).val();
    var parentid = $(this).data("recordid");
    if (selectedOption) {
      var currentUrl = new URL(window.location.href);
      var baseUrl = currentUrl.origin + currentUrl.pathname.split("/overview")[0];
      
      var newUrl = baseUrl + "/new?fn=CourseContentVc&rectype=" + selectedOption + "&parentid=" + parentid;
      window.location.href = newUrl;
    }
  });
}

function toggleEditMode() {
  var url = new URL(window.location.href);
  var hasEditParam = url.searchParams.has("edit");
  
  if (hasEditParam) {
    url.searchParams.delete("edit");
  } else {
    url.searchParams.set("edit", "true");
  }
  window.location.href = url;
}

function deleteRecord(element, register) {
  var selector;
  var course;
  switch (register) {
    case "Course2Vc":
      selector = ".course-line";
      break;
    case "CourseContentVc":
      selector = ".content-line";
      break;
    case "WebNGLMSTopicVc":
      selector = "div#topic";
      course = $(element).closest(selector).data("courseid");
      break;
    default:
      console.error("Invalid record type");
      return;
  }
  
  var recordId = $(element).closest(selector).data("recordid");
  var confirmationMessage = "Are you sure you want to delete this " + (register === "Course2Vc" ? "Course?" : register === "CourseContentVc" ? "Course Content?" : "Topic?");
  
  data = {
    recordId,
    register,
    course,
  };
  var userConfirmed = confirm(confirmationMessage);
  if (userConfirmed) {
    LMSCourses.DeleteRecord(data);
  }
}

function unEnrolStudent(element) {
  var recordId = $(element).data("recordid");
  var rownr = $(element).data("rownr");
  
  data = {
    recordId,
  register: "StudentCourseVc",
    rownr,
  };
  LMSCourses.DeleteRecord(data);
}

function toggleShow(element, visible, editmode) {
  var $targetElement = $(element).closest(".content-line");
  if ($targetElement.length === 0) {
    $targetElement = $(element).closest("div#topic");
  }
  var recordId = $targetElement.data("recordid");
  var recordType = $targetElement.data("recordtype");
  
  $targetElement.find(".show-icon").toggle(!visible);
  $targetElement.find(".hide-icon").toggle(visible);
  
  switch (recordType) {
    case "CourseContentVc":
      LMSCourses.UpdateCourseContentData({
      actiontype: "update_visible",
      coursecontent: recordId,
      visible: visible,
      });
      break;
    case "Course2Vc":
      LMSCourses.UpdateCourseData({
      actiontype: "update_visible",
      course: recordId,
      visible: visible,
      });
      break;
    case "WebNGLMSTopicVc":
      data = { actiontype: "update_visible", visible, topic: recordId };
      LMSCourses.UpdateTopicData(data);
      $targetElement = $(element).closest(".content-list");
      break;
  }
  
  if (recordType != "WebNGLMSTopicVc") {
    $targetElement
    .children()
    .not(".edit-container")
    .toggleClass("hidden-editmode", editmode && !visible)
    .toggleClass("hidden", !editmode && !visible);
  } else {
    $targetElement
    .find("#topic-title")
    .toggleClass("hidden-editmode", editmode && !visible)
    .toggleClass("hidden", !editmode && !visible);
  }
}

function openPopup(url, wname, width, height) {
  window.open(url, wname, "width=" + width + ",height==" + height + ",left=200,top=200");
}

const LMSCourses = new LMSCoursesApp();

function setFormChanged() {
  formChanged = true;
}

function submitForm() {
  isFormSubmitting = true;
  $("form").submit();
}

$(document).ready(function () {
  // $("select").selectize({
  //   sortField: "text",
  // });
  
  $("#toggleButton").on("click", function () {
    var $sidebar = $("#sidebar");
    
    $sidebar.toggleClass("sidebar-hidden");
  });
  
  let isFormSubmitting = false;
  let formChanged = false;
  
  $(document).on("change", "form:not(.login-form) input, form:not(.login-form) textarea, form:not(.login-form) select", setFormChanged);
  $(document).on("click", "#createButton, #registerButton, #applyButton", submitForm);
  $(document).on("submit", "form", function () {
    isFormSubmitting = false;
  });
  
  $(window).on("beforeunload", function (e) {
    if (formChanged && !isFormSubmitting) {
      const confirmationMessage = "There are unsaved changes. Are you sure you want to leave?";
      e.returnValue = confirmationMessage; // For cross-browser compatibility
      return confirmationMessage; // Chrome requires returnValue to be set
    }
  });
  
  $("#department-select, #teacher-select").change(updateQueryString);
  $(document).on("click", "#remove-classification, #remove-teacher, #remove-department", function () {
    $(this).parent().remove();
  });
  addTagFromSelect("#classification-form-select", "#classification-list", "classification", "remove-classification");
  addTagFromSelect("#teacher-form-select", "#teacher-list", "teacher", "remove-teacher");
  addTagFromSelect("#department-form-select", "#department-list", "department", "remove-department");
  
  $("#createCourseContent").submit(function (event) {
    event.preventDefault();
    $("#createButton").prop("disabled", true);
    
    var editmode = $("#editmode").val();
    var actiontype;
    
    if (editmode == "1") {
      actiontype = "update_record";
    } else {
      actiontype = "create_record";
    }
    
    var sortOrder = -1;
    var coursecontent = $("#recnr").val();
    var name = $("#name").val();
    var url = $("#url").val();
    var appearance = $("#appearance").val();
    var description = $("#description").val();
    var visible = $("#visible").is(":checked") ? 1 : 0;
    var visibleFromDate = $("#visibleFromDate").val();
    var visibleFromTime = $("#visibleFromTime").val();
    var visibleToDate = $("#visibleToDate").val();
    var visibleToTime = $("#visibleToTime").val();
    var rectype = $("#rectype").val();
    var topicId = $("#parentid").val();
    var fileDisplay = $("#filedisplay").val();
    var showSize = $("#showsize").is(":checked") ? 1 : 0;
    var showType = $("#showtype").is(":checked") ? 1 : 0;
    var showDate = $("#showdate").is(":checked") ? 1 : 0;
    var attendanceDate = $("#attendanceDate").val();
    var attendanceFromTime = $("#attendanceFromTime").val();
    var attendanceToTime = $("#attendanceToTime").val();
    var repeatUntilDate = $("#repeatUntilDate").val();
    var repeatPeriod = $("#repeatPeriod").val();
    var everyMonday = $("#everyMonday").is(":checked") ? 1 : 0;
    var everyTuesday = $("#everyTuesday").is(":checked") ? 1 : 0;
    var everyWednesday = $("#everyWednesday").is(":checked") ? 1 : 0;
    var everyThursday = $("#everyThursday").is(":checked") ? 1 : 0;
    var everyFriday = $("#everyFriday").is(":checked") ? 1 : 0;
    var everySaturday = $("#everySaturday").is(":checked") ? 1 : 0;
    var everySunday = $("#everySunday").is(":checked") ? 1 : 0;
    var inclHolidays = $("#inclHolidays").is(":checked") ? 1 : 0;
    var webtest = $("#webtest").val();
    var fileName = "";
    var fileContent = "";
    
    if (rectype == 2 && $("#fileupload").val() != null) {
      fileName = $("#fileupload").val().split("\\").pop();
    }
    
    var data = {
      actiontype,
      sortOrder,
      coursecontent,
      rectype,
      topicId,
      name,
      url,
      appearance,
      description,
      visible,
      visibleFromDate,
      visibleFromTime,
      visibleToDate,
      visibleToTime,
      fileDisplay,
      showSize,
      showType,
      showDate,
      fileName,
      fileContent,
      attendanceDate,
      attendanceFromTime,
      attendanceToTime,
      repeatUntilDate,
      repeatPeriod,
      everyMonday,
      everyTuesday,
      everyWednesday,
      everyThursday,
      everyFriday,
      everySaturday,
      everySunday,
      inclHolidays,
      webtest,
    };
    
    if (rectype == 2 && $("#fileupload").val() != null) {
      createLoadingElements();
      if ($("#fileupload")[0].files.length > 0) {
        var reader = new FileReader();
        
        reader.onload = function (e) {
          data.fileContent = e.target.result;
          LMSCourses.UpdateCourseContentData(data);
        };
        
        reader.readAsDataURL($("#fileupload")[0].files[0]);
      } else {
        LMSCourses.UpdateCourseContentData(data);
      }
    } else {
      LMSCourses.UpdateCourseContentData(data);
    }
  });
  
  $("#createTopic").submit(function (event) {
    event.preventDefault();
    $("#createButton").prop("disabled", true);
    
    var editmode = $("#editmode").val();
    var actiontype;
    
    if (editmode == "1") {
      actiontype = "update_record";
    } else {
      actiontype = "create_record";
    }
    
    var topic = $("#recnr").val();
    var name = $("#name").val();
    var visible = $("#visible").is(":checked") ? 1 : 0;
    var courseId = $("#parentid").val();
    
    var data = {
      actiontype,
      name,
      visible,
      courseId,
      topic,
    };
    
    LMSCourses.UpdateTopicData(data);
  });
  
  $("#enrolButton, #applyButton").click(function (event) {
    event.preventDefault();
    $("#enrolButton").prop("disabled", true);
    $("#applyButton").prop("disabled", true);
    
    var action = "create";
    var regkey = $("#regkey").val();
    var course = $("#course").val();
    var student = $("#student").val();
    var apply = $(this).data("apply");
    var selfEnrol = 1;
    
    var data = {
      action,
      regkey,
      course,
      selfEnrol,
      student,
      apply,
    };
    
    LMSCourses.EnrolStudent(data);
  });
  
  $("#classification-form-select").change(function () {
    let selectedValue = $(this).val();
    if (selectedValue) {
      let classificationName = $(this).find("option:selected").val();
      let classification = $('<span class="classification"></span>').text(classificationName);
      let removeBtn = $('<span id="remove-classification">X</span>');
      
      removeBtn.click(function () {
        $(this).parent().remove();
      });
      
      classification.append(removeBtn).appendTo("#classification-list");
      $(this).val("");
    }
  });
  $("#teacher-form-select").change(function () {
    let selectedValue = $(this).val();
    if (selectedValue) {
      let classificationName = $(this).find("option:selected").val();
      let classification = $('<span class="teacher"></span>').text(classificationName);
      let removeBtn = $('<span id="remove-teacher">X</span>');
      
      removeBtn.click(function () {
        $(this).parent().remove();
      });
      
      classification.append(removeBtn).appendTo("#teacher-list");
      $(this).val("");
    }
  });
  $("#department-form-select").change(function () {
    let selectedValue = $(this).val();
    if (selectedValue) {
      let classificationName = $(this).find("option:selected").val();
      let classification = $('<span class="department"></span>').text(classificationName);
      let removeBtn = $('<span id="remove-department">X</span>');
      
      removeBtn.click(function () {
        $(this).parent().remove();
      });
      
      classification.append(removeBtn).appendTo("#department-list");
      $(this).val("");
    }
  });
  $("#createCourse").submit(function (event) {
    event.preventDefault();
    $("#createButton").prop("disabled", true);
    
    var editmode = $("#editmode").val();
    var actiontype;
    
    if (editmode == "1") {
      actiontype = "update_record";
    } else {
      actiontype = "create_record";
    }
    
    var course = $("#recnr").val();
    var name = $("#name").val();
    var visible = $("#visible").is(":checked") ? 1 : 0;
    var startdate = $("#startdate").val();
    var enddate = $("#enddate").val();
    var description = $("#description").val();
    var coursetype = $("#coursetype").val();
    var acttype = $("#acttype").val();
    var classification = getClassifications();
    var teacher = getTeachers();
    var department = getDepartments();
    var responsible = $("#responsible").val();
    var format = $('input[name="format"]:checked').val();
    var groups = $('input[name="groups"]:checked').val();
    var selfenrol = $("#selfenrol").is(":checked") ? 1 : 0;
    var regkey = $("#regkey").val();
    var allowapplications = $("#allowapplications").is(":checked") ? 1 : 0;
    
    var data = {
      actiontype,
      name,
      visible,
      startdate,
      enddate,
      description,
      coursetype,
      acttype,
      classification,
      teacher,
      department,
      responsible,
      format,
      groups,
      course,
      selfenrol,
      regkey,
      allowapplications,
    };
    
    LMSCourses.UpdateCourseData(data);
  });
});

function updateTopicSortOrder(element) {
  $(element).off("click");
  var moveUp = $(element).hasClass("arrow-up");
  
  var actiontype = "update_sortorder";
  var direction = moveUp ? "up" : "down";
  var topic = $(element).closest("#topic").data("recordid");
  
  LMSCourses.UpdateTopicData({ actiontype, direction, topic });
  setTimeout(function () {
    $(element).on("click", function () {
      updateTopicSortOrder(this);
    });
  }, 2000);
}

function updateQueryString() {
  var queryParams = new URLSearchParams(window.location.search);
  
  var selectedDepartment = $("#department-select").val();
  var selectedTeacher = $("#teacher-select").val();
  
  if (selectedDepartment) {
    queryParams.set("department", selectedDepartment);
  } else {
    queryParams.delete("department");
  }
  
  if (selectedTeacher) {
    queryParams.set("teacher", selectedTeacher);
  } else {
    queryParams.delete("teacher");
  }
  
  var queryString = queryParams.toString();
  window.location.href = queryString ? "?" + queryString : ".";
}

function getClassifications() {
  var classifications = [];
  $("#classification-list .classification").each(function () {
    let classificationText = $(this).clone().children().remove().end().text().trim();
    classifications.push(classificationText);
  });
  return classifications.join(",");
}

function getTeachers() {
  var teachers = [];
  $("#teacher-list .teacher").each(function () {
    let teacherText = $(this).clone().children().remove().end().text().trim();
    teachers.push(teacherText);
  });
  return teachers.join(",");
}

function getDepartments() {
  var departments = [];
  $("#department-list .department").each(function () {
    let departmentText = $(this).clone().children().remove().end().text().trim();
    departments.push(departmentText);
  });
  return departments.join(",");
}

function editRecord(element, fn, rectype, recnr) {
  var targetClass = "";
  switch (fn) {
    case "CourseContentVc":
      targetClass = ".content-line";
      break;
    case "Course2Vc":
      targetClass = ".course-line";
      break;
    case "WebNGLMSTopicVc":
      targetClass = "#topic";
      break;
    default:
      break;
  }
  $targetElement = $(element).closest(targetClass);
  var currentUrl = new URL(window.location.href);
  var baseUrl = currentUrl.origin + currentUrl.pathname.split("/overview")[0];
  
  var newUrl = baseUrl + "/edit/" + recnr + "?fn=" + fn + "&rectype=" + rectype;
  window.location.href = newUrl;
}

function addTagFromSelect(selectId, listId, className, removeBtnClass) {
  $(selectId).change(function () {
    let selectedValue = $(this).val();
    if (selectedValue) {
      let itemName = $(this).find("option:selected").val();
      let item = $('<span class="' + className + '"></span>').text(itemName);
      let removeBtn = $('<span id="' + removeBtnClass + '">X</span>');
      
      item.append(removeBtn).appendTo(listId);
      $(this).val(""); // Reset the select
    }
  });
}

function addStudent(buttonElement) {
  $(buttonElement).prop("disabled", true);
  var course = $(buttonElement).data("courseid");
  var row = $(buttonElement).closest("tr");
  
  var action = "create";
  var student = row.find("#newstudent").val();
  var availableFromDate = row.find("#availableFromDate").val();
  var availableFromTime = row.find("#availableFromTime").val();
  var availableToDate = row.find("#availableToDate").val();
  var availableToTime = row.find("#availableToTime").val();
  var approved = 1;
  var selfEnrol = 0;
  
  var data = {
    action,
    student,
    availableFromDate,
    availableFromTime,
    availableToDate,
    availableToTime,
    selfEnrol,
    course,
    approved,
  };
  
  LMSCourses.EnrolStudent(data);
}

function updateStudent(buttonElement, approved) {
  $(buttonElement).prop("disabled", true);
  var student = $(buttonElement).data("recordid");
  var row = $(buttonElement).closest("tr");
  
  var action = "update";
  var availableFromDate = row.find("#availableFromDate").val();
  var availableFromTime = row.find("#availableFromTime").val();
  var availableToDate = row.find("#availableToDate").val();
  var availableToTime = row.find("#availableToTime").val();
  var selfEnrol = 0;
  
  var data = {
    action,
    student,
    availableFromDate,
    availableFromTime,
    availableToDate,
    availableToTime,
    selfEnrol,
    approved,
  };
  
  LMSCourses.EnrolStudent(data);
}

function unEnrolAll(course) {
  var confirmationMessage = "Are you sure you want to unenrol all students from this course?";
  var userConfirmed = confirm(confirmationMessage);
  if (userConfirmed) {
    LMSCourses.StudentCourseDeleteAll(course);
  }
}

function GoBackWithRefresh(event) {
  if ("referrer" in document) {
    window.location = document.referrer;
    /* OR */
    //location.replace(document.referrer);
  } else {
    window.history.back();
  }
}

function createLoadingElements() {
  if ($(".overlay, .spinner").length === 0) {
    var overlay = $("<div>", { class: "overlay" });
    var spinner = $("<div>", { class: "spinner" });
    var loader = $("<div>", { class: "loader" });
    var message = $("<p>").text("Uploading file, please wait.");
    
    spinner.append(loader, message);
    $("body").append(overlay, spinner);
  }
  
  $(".overlay, .spinner").addClass("show");
}

function removeLoadingElements() {
  $(".overlay, .spinner")
  .removeClass("show")
  .on("transitionend", function () {
    $(this).remove();
  });
}

function updateCourseContentSortOrder(sortedIds) {
  sortedIds.forEach((coursecontent, index) => {
    LMSCourses.UpdateCourseContentData({
    actiontype: "update_sortorder",
    sortOrder: index,
    coursecontent: coursecontent,
    });
  });
}
