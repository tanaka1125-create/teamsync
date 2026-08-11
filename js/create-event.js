(function initializeCreateEventForm() {
  "use strict";

  const form = document.querySelector("#create-event-form");

  if (!form) {
    return;
  }

  const titleInput = form.querySelector("#event-title");
  const descriptionInput = form.querySelector("#event-description");
  const titleError = form.querySelector("#event-title-error");
  const titleCount = form.querySelector("#event-title-count");
  const descriptionCount = form.querySelector("#event-description-count");
  const phaseNotice = form.querySelector("#phase-notice");

  function updateCount(input, output) {
    output.textContent = `${input.value.length} / ${input.maxLength}`;
  }

  function validateTitle() {
    const isValid = titleInput.value.trim().length > 0;
    titleInput.setAttribute("aria-invalid", String(!isValid));
    titleError.textContent = isValid ? "" : "イベント名を入力してください。";
    return isValid;
  }

  titleInput.addEventListener("input", function handleTitleInput() {
    updateCount(titleInput, titleCount);

    if (titleInput.getAttribute("aria-invalid") === "true") {
      validateTitle();
    }
  });

  descriptionInput.addEventListener("input", function handleDescriptionInput() {
    updateCount(descriptionInput, descriptionCount);
  });

  form.addEventListener("submit", function handleSubmit(event) {
    event.preventDefault();

    if (!validateTitle()) {
      phaseNotice.hidden = true;
      titleInput.focus();
      return;
    }

    phaseNotice.textContent =
      "入力内容を確認しました。イベント保存機能はSupabase接続後のフェーズで有効になります。";
    phaseNotice.hidden = false;
  });
})();
