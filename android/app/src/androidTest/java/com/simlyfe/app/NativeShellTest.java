package com.simlyfe.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Checks the installed package's identity and actual platform security policy. */
@RunWith(AndroidJUnit4.class)
public class NativeShellTest {
    @Test
    public void installedPackageHasSimlyfeIdentity() {
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.simlyfe.app", app.getPackageName());
        assertEquals("SIMLYFE", app.getString(R.string.app_name));
    }

    @Test
    public void installedPackageDisablesBackupAndCleartext() {
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(0, app.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertFalse(NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted());
    }
}
